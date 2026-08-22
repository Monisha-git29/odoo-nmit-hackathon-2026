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
    
    # Attendance exceptions/alerts fields
    consecutive_absence_count = fields.Integer(
        string='Consecutive Absences',
        compute='_compute_attendance_alerts'
    )
    late_checkin_count = fields.Integer(
        string='Late Check-Ins (Last 30 Days)',
        compute='_compute_attendance_alerts'
    )
    missing_checkout_count = fields.Integer(
        string='Missing Check-Outs',
        compute='_compute_attendance_alerts'
    )
    attendance_alerts_summary = fields.Text(
        string='Attendance Alerts Summary',
        compute='_compute_attendance_alerts'
    )
    has_alerts = fields.Boolean(
        string='Has Attendance Alerts',
        compute='_compute_attendance_alerts'
    )

    def _compute_attendance_alerts(self):
        from datetime import datetime, time as datetime_time, timedelta
        import pytz

        tz = pytz.timezone(self.env.user.tz or 'UTC')
        now_local = datetime.now(tz)
        today = now_local.date()

        for emp in self:
            # 1. Missing Checkouts (check_out is null)
            missing_cos = self.env['hr.attendance'].search_count([
                ('employee_id', '=', emp.id),
                ('check_out', '=', False)
            ])

            # 2. Late Checkins (within last 30 days)
            thirty_days_ago = today - timedelta(days=30)
            thirty_days_ago_utc = tz.localize(datetime.combine(thirty_days_ago, datetime_time.min)).astimezone(pytz.utc)

            attendances = self.env['hr.attendance'].search([
                ('employee_id', '=', emp.id),
                ('check_in', '>=', thirty_days_ago_utc)
            ])

            late_count = 0
            # Let's say default late check-in limit is 09:00 AM local time
            expected_hour = 9
            expected_minute = 0

            for att in attendances:
                local_check_in = att.check_in.astimezone(tz)
                if local_check_in.time() > datetime_time(expected_hour, expected_minute):
                    late_count += 1

            # 3. Consecutive Absences (working days only, last 15 days check)
            consecutive_abs = 0
            max_consecutive_abs = 0

            for i in range(1, 16):
                check_date = today - timedelta(days=i)
                # Skip weekends
                if check_date.weekday() in (5, 6): # 5 = Saturday, 6 = Sunday
                    continue

                day_start_utc = tz.localize(datetime.combine(check_date, datetime_time.min)).astimezone(pytz.utc)
                day_end_utc = tz.localize(datetime.combine(check_date, datetime_time.max)).astimezone(pytz.utc)

                has_att = self.env['hr.attendance'].search_count([
                    ('employee_id', '=', emp.id),
                    ('check_in', '>=', day_start_utc),
                    ('check_in', '<=', day_end_utc)
                ]) > 0

                has_leave = self.env['hr.leave'].search_count([
                    ('employee_id', '=', emp.id),
                    ('date_from', '<=', day_end_utc),
                    ('date_to', '>=', day_start_utc),
                    ('state', '=', 'validate')
                ]) > 0

                if not has_att and not has_leave:
                    consecutive_abs += 1
                    if consecutive_abs > max_consecutive_abs:
                        max_consecutive_abs = consecutive_abs
                else:
                    # Reset counter on working day check-in or approved leave
                    consecutive_abs = 0

            alerts = []
            if max_consecutive_abs >= 3:
                alerts.append(_("• %d consecutive absences") % max_consecutive_abs)
            if late_count >= 4:
                alerts.append(_("• %d late check-ins") % late_count)
            if missing_cos > 0:
                alerts.append(_("• %d missing check-outs") % missing_cos)

            emp.missing_checkout_count = missing_cos
            emp.late_checkin_count = late_count
            emp.consecutive_absence_count = max_consecutive_abs
            emp.has_alerts = len(alerts) > 0
            emp.attendance_alerts_summary = "\n".join(alerts) if alerts else ""


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
