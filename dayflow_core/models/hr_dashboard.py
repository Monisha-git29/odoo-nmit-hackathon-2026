# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from datetime import datetime, time
import pytz

class HRDashboard(models.TransientModel):
    _name = 'dayflow.hr.dashboard'
    _description = 'Dayflow HR Dashboard'

    total_employees = fields.Integer(string='Total Employees', compute='_compute_stats')
    present_today = fields.Integer(string='Present Today', compute='_compute_stats')
    absent_today = fields.Integer(string='Absent Today', compute='_compute_stats')
    on_leave_today = fields.Integer(string='On Leave Today', compute='_compute_stats')
    pending_leaves = fields.Integer(string='Pending Leave Requests', compute='_compute_stats')
    pending_corrections = fields.Integer(string='Pending Corrections', compute='_compute_stats')
    missing_checkouts = fields.Integer(string='Missing Check-outs', compute='_compute_stats')
    documents_pending = fields.Integer(string='Documents Pending Verification', compute='_compute_stats')
    profile_issues = fields.Integer(string='Employee Profile Issues', compute='_compute_stats')

    def _compute_stats(self):
        # Timezone calculations
        tz = pytz.timezone(self.env.user.tz or 'UTC')
        local_today = datetime.now(tz).date()
        date_start = datetime.combine(local_today, time.min)
        date_end = datetime.combine(local_today, time.max)
        
        start_utc = tz.localize(date_start).astimezone(pytz.utc)
        end_utc = tz.localize(date_end).astimezone(pytz.utc)

        # Count total active employees
        tot_emp = self.env['hr.employee'].search_count([])
        
        # Count present today (who checked in today)
        pres_today = self.env['hr.attendance'].search_count([
            ('check_in', '>=', start_utc),
            ('check_in', '<=', end_utc)
        ])
        
        # Count on leave today (who have approved leave today)
        on_leave = self.env['hr.leave'].search_count([
            ('date_from', '<=', end_utc),
            ('date_to', '>=', start_utc),
            ('state', '=', 'validate')
        ])
        
        # Count absent today (active employees - present - on leave)
        abs_today = max(0, tot_emp - pres_today - on_leave)

        # Count pending leaves (state 'confirm')
        pend_leaves = self.env['hr.leave'].search_count([
            ('state', '=', 'confirm')
        ])

        # Count pending corrections
        pend_corrs = self.env['dayflow.attendance.correction'].search_count([
            ('status', '=', 'pending')
        ])

        # Count missing checkouts (checkout is False)
        miss_checkouts = self.env['hr.attendance'].search_count([
            ('check_out', '=', False)
        ])

        # Count pending documents
        pend_docs = self.env['dayflow.employee.document'].search_count([
            ('status', '=', 'pending')
        ])

        # Count profile issues: phone, work_mode, department, job, joining date
        prof_issues = self.env['hr.employee'].search_count([
            '|', '|', '|', '|',
            ('mobile_phone', '=', False),
            ('work_mode', '=', False),
            ('department_id', '=', False),
            ('job_id', '=', False),
            ('joining_date', '=', False)
        ])

        for record in self:
            record.total_employees = tot_emp
            record.present_today = pres_today
            record.absent_today = abs_today
            record.on_leave_today = on_leave
            record.pending_leaves = pend_leaves
            record.pending_corrections = pend_corrs
            record.missing_checkouts = miss_checkouts
            record.documents_pending = pend_docs
            record.profile_issues = prof_issues

    def action_view_employees(self):
        return {
            'name': _('Total Employees'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'view_mode': 'tree,form',
            'target': 'current',
        }
        
    def action_view_present(self):
        tz = pytz.timezone(self.env.user.tz or 'UTC')
        local_today = datetime.now(tz).date()
        date_start = datetime.combine(local_today, time.min)
        date_end = datetime.combine(local_today, time.max)
        start_utc = tz.localize(date_start).astimezone(pytz.utc)
        end_utc = tz.localize(date_end).astimezone(pytz.utc)
        
        attendances = self.env['hr.attendance'].search([
            ('check_in', '>=', start_utc),
            ('check_in', '<=', end_utc)
        ])
        employee_ids = attendances.mapped('employee_id').ids
        return {
            'name': _('Present Employees Today'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', employee_ids)],
            'target': 'current',
        }

    def action_view_absent(self):
        tz = pytz.timezone(self.env.user.tz or 'UTC')
        local_today = datetime.now(tz).date()
        date_start = datetime.combine(local_today, time.min)
        date_end = datetime.combine(local_today, time.max)
        start_utc = tz.localize(date_start).astimezone(pytz.utc)
        end_utc = tz.localize(date_end).astimezone(pytz.utc)

        present_emp_ids = self.env['hr.attendance'].search([
            ('check_in', '>=', start_utc),
            ('check_in', '<=', end_utc)
        ]).mapped('employee_id').ids

        on_leave_emp_ids = self.env['hr.leave'].search([
            ('date_from', '<=', end_utc),
            ('date_to', '>=', start_utc),
            ('state', '=', 'validate')
        ]).mapped('employee_id').ids

        return {
            'name': _('Absent Employees Today'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'view_mode': 'tree,form',
            'domain': [('id', 'not in', present_emp_ids + on_leave_emp_ids)],
            'target': 'current',
        }

    def action_view_on_leave(self):
        tz = pytz.timezone(self.env.user.tz or 'UTC')
        local_today = datetime.now(tz).date()
        date_start = datetime.combine(local_today, time.min)
        date_end = datetime.combine(local_today, time.max)
        start_utc = tz.localize(date_start).astimezone(pytz.utc)
        end_utc = tz.localize(date_end).astimezone(pytz.utc)

        leaves = self.env['hr.leave'].search([
            ('date_from', '<=', end_utc),
            ('date_to', '>=', start_utc),
            ('state', '=', 'validate')
        ])
        employee_ids = leaves.mapped('employee_id').ids
        return {
            'name': _('Employees On Leave Today'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', employee_ids)],
            'target': 'current',
        }

    def action_view_pending_leaves(self):
        return {
            'name': _('Pending Leave Requests'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.leave',
            'view_mode': 'tree,form',
            'domain': [('state', '=', 'confirm')],
            'target': 'current',
        }

    def action_view_pending_corrections(self):
        return {
            'name': _('Attendance Corrections'),
            'type': 'ir.actions.act_window',
            'res_model': 'dayflow.attendance.correction',
            'view_mode': 'tree,form',
            'domain': [('status', '=', 'pending')],
            'target': 'current',
        }

    def action_view_missing_checkouts(self):
        return {
            'name': _('Missing Check-Outs'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.attendance',
            'view_mode': 'tree,form',
            'domain': [('check_out', '=', False)],
            'target': 'current',
        }

    def action_view_documents_pending(self):
        return {
            'name': _('Pending Document Verification'),
            'type': 'ir.actions.act_window',
            'res_model': 'dayflow.employee.document',
            'view_mode': 'tree,form',
            'domain': [('status', '=', 'pending')],
            'target': 'current',
        }

    def action_view_profile_issues(self):
        return {
            'name': _('Employee Profile Issues'),
            'type': 'ir.actions.act_window',
            'res_model': 'hr.employee',
            'view_mode': 'tree,form',
            'domain': [
                '|', '|', '|', '|',
                ('mobile_phone', '=', False),
                ('work_mode', '=', False),
                ('department_id', '=', False),
                ('job_id', '=', False),
                ('joining_date', '=', False)
            ],
            'target': 'current',
        }
