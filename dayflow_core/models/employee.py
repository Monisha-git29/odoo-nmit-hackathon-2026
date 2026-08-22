# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class Employee(models.Model):
    _inherit = 'hr.employee'

    employee_id = fields.Char(
        string='Employee ID',
        readonly=True,
        copy=False,
        index=True
    )
    joining_date = fields.Date(
        string='Joining Date',
        default=fields.Date.context_today
    )
    work_mode = fields.Selection([
        ('office', 'Office'),
        ('wfh', 'Work From Home'),
        ('hybrid', 'Hybrid')
    ], string='Work Mode', default='office', required=True)
    
    create_user_checkbox = fields.Boolean(
        string='Create Odoo User',
        default=True,
        help="Check this box to automatically create a linked Odoo User on employee creation."
    )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('employee_id') or vals.get('employee_id') == '/':
                vals['employee_id'] = self.env['ir.sequence'].next_by_code('dayflow.employee.id') or '/'
            
            # User creation integration
            create_user = vals.get('create_user_checkbox', True)
            if create_user and not vals.get('user_id'):
                name = vals.get('name')
                email = vals.get('work_email') or f"{vals.get('employee_id').lower()}@dayflow.com"
                
                # Check if user already exists
                existing_user = self.env['res.users'].search([('login', '=', email)], limit=1)
                if existing_user:
                    vals['user_id'] = existing_user.id
                else:
                    user_vals = {
                        'name': name,
                        'login': email,
                        'email': email,
                        'password': 'Welcome@Dayflow2026',
                    }
                    # Attach the Dayflow Employee security group if exists
                    group_emp = self.env.ref('dayflow_core.group_employee', raise_if_not_found=False)
                    if group_emp:
                        user_vals['groups_id'] = [(6, 0, [group_emp.id])]
                    
                    new_user = self.env['res.users'].create(user_vals)
                    vals['user_id'] = new_user.id
                    
        return super(Employee, self).create(vals_list)


class ResCompany(models.Model):
    _inherit = 'res.company'

    office_latitude = fields.Float(
        string='Office Latitude',
        digits=(10, 7),
        default=12.9715987, # Default to Bengaluru coordinate for hackathon
        help="Latitude coordinates for geofence check."
    )
    office_longitude = fields.Float(
        string='Office Longitude',
        digits=(10, 7),
        default=77.5945627, # Default to Bengaluru coordinate for hackathon
        help="Longitude coordinates for geofence check."
    )
    geofence_radius = fields.Float(
        string='Allowed Geofence Radius (meters)',
        default=200.0,
        help="Allowed check-in radius from office coordinates."
    )
    standard_work_hours = fields.Float(
        string='Standard Working Hours (daily)',
        default=8.0,
        help="Standard work hours expected from an employee per day."
    )
