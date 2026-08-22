# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError
from datetime import datetime, time
import pytz

class AttendanceCorrection(models.Model):
    _name = 'dayflow.attendance.correction'
    _description = 'Attendance Correction Request'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'attendance_date desc, id desc'

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        tracking=True
    )
    attendance_id = fields.Many2one(
        'hr.attendance',
        string='Original Attendance Record',
        tracking=True
    )
    attendance_date = fields.Date(
        string='Attendance Date',
        required=True,
        tracking=True
    )
    issue_type = fields.Selection([
        ('forgot_check_in', 'Forgot Check-In'),
        ('forgot_check_out', 'Forgot Check-Out'),
        ('incorrect_time', 'Incorrect Time')
    ], string='Issue Type', required=True, tracking=True)
    
    reason = fields.Text(
        string='Reason',
        required=True
    )
    requested_check_in = fields.Datetime(
        string='Requested Check-In',
        tracking=True
    )
    requested_check_out = fields.Datetime(
        string='Requested Check-Out',
        tracking=True
    )
    status = fields.Selection([
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='pending', tracking=True)
    
    hr_comment = fields.Text(
        string='HR Comment',
        tracking=True
    )
    approved_by = fields.Many2one(
        'res.users',
        string='Approved/Rejected By',
        readonly=True,
        tracking=True
    )
    approved_at = fields.Datetime(
        string='Actioned At',
        readonly=True,
        tracking=True
    )

    @api.constrains('requested_check_in', 'requested_check_out')
    def _check_datetime_sequence(self):
        for record in self:
            if record.requested_check_in and record.requested_check_out:
                if record.requested_check_out <= record.requested_check_in:
                    raise ValidationError(_("Requested Check-Out must be after Requested Check-In."))

    def action_approve(self):
        self.ensure_one()
        if self.status != 'pending':
            raise UserError(_("Only pending correction requests can be approved."))
        
        # Find timezone of company/user to establish day boundaries
        tz = pytz.timezone(self.env.user.tz or 'UTC')
        date_start = datetime.combine(self.attendance_date, time.min)
        date_end = datetime.combine(self.attendance_date, time.max)
        
        # Localize to User Tz, convert to UTC
        start_utc = tz.localize(date_start).astimezone(pytz.utc)
        end_utc = tz.localize(date_end).astimezone(pytz.utc)

        # Search for existing attendance record on that date
        attendance = self.env['hr.attendance'].search([
            ('employee_id', '=', self.employee_id.id),
            ('check_in', '>=', start_utc),
            ('check_in', '<=', end_utc)
        ], limit=1)

        attendance_vals = {}
        if self.issue_type == 'forgot_check_in':
            if not self.requested_check_in:
                raise UserError(_("Requested Check-In is required for Forgot Check-In issue type."))
            attendance_vals['check_in'] = self.requested_check_in
        elif self.issue_type == 'forgot_check_out':
            if not self.requested_check_out:
                raise UserError(_("Requested Check-Out is required for Forgot Check-Out issue type."))
            attendance_vals['check_out'] = self.requested_check_out
        elif self.issue_type == 'incorrect_time':
            if not self.requested_check_in or not self.requested_check_out:
                raise UserError(_("Both Requested Check-In and Check-Out are required for Incorrect Time issue type."))
            attendance_vals['check_in'] = self.requested_check_in
            attendance_vals['check_out'] = self.requested_check_out

        if attendance:
            # Update existing
            attendance.write(attendance_vals)
            self.attendance_id = attendance.id
        else:
            # Create new
            # If forgot check out but no check-in exists, we use check_in as requested_check_in or standard time start
            if self.issue_type == 'forgot_check_out' and not self.requested_check_in:
                # Default check_in to standard start hours (e.g. 9:00 AM local time)
                std_time_start = datetime.combine(self.attendance_date, time(9, 0))
                attendance_vals['check_in'] = tz.localize(std_time_start).astimezone(pytz.utc)
            
            # If forgot check in but no check-out exists, we only set check-in
            if 'check_in' not in attendance_vals:
                attendance_vals['check_in'] = self.requested_check_in

            attendance_vals['employee_id'] = self.employee_id.id
            new_attendance = self.env['hr.attendance'].create(attendance_vals)
            self.attendance_id = new_attendance.id

        # Update correction record status
        self.write({
            'status': 'approved',
            'approved_by': self.env.user.id,
            'approved_at': fields.Datetime.now()
        })
        
        # Post notification in chatter
        self.message_post(body=_("Attendance correction request has been APPROVED by %s.") % self.env.user.name)
        # Notify employee
        self.employee_id.message_post(
            body=_("Your attendance correction request for %s has been APPROVED by HR.") % self.attendance_date
        )

    def action_reject(self):
        self.ensure_one()
        if self.status != 'pending':
            raise UserError(_("Only pending correction requests can be rejected."))
        
        self.write({
            'status': 'rejected',
            'approved_by': self.env.user.id,
            'approved_at': fields.Datetime.now()
        })

        self.message_post(body=_("Attendance correction request has been REJECTED by %s. Comment: %s") % (self.env.user.name, self.hr_comment or 'No comment.'))
        # Notify employee
        self.employee_id.message_post(
            body=_("Your attendance correction request for %s has been REJECTED by HR. Remark: %s") % (self.attendance_date, self.hr_comment or 'No comment provided.')
        )
