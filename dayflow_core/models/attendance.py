# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class HrAttendance(models.Model):
    _inherit = 'hr.attendance'

    daily_status = fields.Selection([
        ('present', 'Present'),
        ('absent', 'Absent'),
        ('half_day', 'Half Day'),
        ('leave', 'Leave'),
        ('incomplete', 'Incomplete')
    ], string='Daily Status', compute='_compute_daily_status', store=True, tracking=True)

    @api.depends('check_in', 'check_out', 'worked_hours')
    def _compute_daily_status(self):
        for rec in self:
            if not rec.check_out:
                rec.daily_status = 'incomplete'
            else:
                # Retrieve standard daily working hours from company (default 8.0)
                std_hours = rec.employee_id.company_id.standard_work_hours or 8.0
                if rec.worked_hours >= std_hours:
                    rec.daily_status = 'present'
                elif rec.worked_hours >= (std_hours / 2.0):
                    rec.daily_status = 'half_day'
                else:
                    # Checked out but worked very few hours
                    rec.daily_status = 'incomplete'
