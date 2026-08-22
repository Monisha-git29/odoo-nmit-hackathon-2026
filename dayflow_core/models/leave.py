# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class HrLeave(models.Model):
    _inherit = 'hr.leave'

    hr_comment = fields.Text(
        string='HR Review Comment',
        tracking=True,
        help="Reason for approval or rejection."
    )

    @api.model
    def get_team_availability(self, department_id, date_from, date_to):
        """
        Compute team availability and overlapping leaves for a department and date range.
        Can be called directly by Member 1's Smart Leave Notice.
        """
        if not department_id:
            return {
                'total_employees': 0,
                'present': 0,
                'on_leave': 0,
                'absent': 0,
                'overlapping_leaves': []
            }

        # Find all employees in the department
        employees = self.env['hr.employee'].search([('department_id', '=', department_id)])
        total_employees = len(employees)

        # Convert strings to datetime if necessary
        if isinstance(date_from, str):
            date_from = fields.Datetime.to_datetime(date_from)
        if isinstance(date_to, str):
            date_to = fields.Datetime.to_datetime(date_to)

        # Find approved leaves overlapping with the range
        overlapping_leaves = self.env['hr.leave'].search([
            ('employee_id', 'in', employees.ids),
            ('state', '=', 'validate'),
            ('date_from', '<=', date_to),
            ('date_to', '>=', date_from)
        ])

        leave_emp_ids = overlapping_leaves.mapped('employee_id').ids
        on_leave_count = len(set(leave_emp_ids))

        # Find check-ins during this period
        checked_in_emp_ids = self.env['hr.attendance'].search([
            ('employee_id', 'in', employees.ids),
            ('check_in', '>=', date_from),
            ('check_in', '<=', date_to)
        ]).mapped('employee_id').ids
        present_count = len(set(checked_in_emp_ids))

        # Absent is rest of the team
        absent_count = max(0, total_employees - present_count - on_leave_count)

        on_leave_details = []
        for leave in overlapping_leaves:
            on_leave_details.append({
                'employee_id': leave.employee_id.id,
                'employee_name': leave.employee_id.name,
                'leave_type': leave.holiday_status_id.name,
                'date_from': fields.Datetime.to_string(leave.date_from),
                'date_to': fields.Datetime.to_string(leave.date_to),
            })

        return {
            'total_employees': total_employees,
            'present': present_count,
            'on_leave': on_leave_count,
            'absent': absent_count,
            'overlapping_leaves': on_leave_details
        }

    def action_approve(self):
        # Notify employee upon approval
        res = super(HrLeave, self).action_approve()
        for leave in self:
            leave.employee_id.message_post(
                body=_("Your leave request from %s to %s has been APPROVED. HR Comment: %s") % 
                     (leave.date_from.date(), leave.date_to.date(), leave.hr_comment or 'None')
            )
        return res

    def action_refuse(self):
        # Notify employee upon refusal
        res = super(HrLeave, self).action_refuse()
        for leave in self:
            leave.employee_id.message_post(
                body=_("Your leave request from %s to %s has been REJECTED. Reason: %s") % 
                     (leave.date_from.date(), leave.date_to.date(), leave.hr_comment or 'No reason specified.')
            )
        return res
