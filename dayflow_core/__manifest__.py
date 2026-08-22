# -*- coding: utf-8 -*-
{
    'name': 'Dayflow Core',
    'version': '1.0',
    'category': 'Human Resources',
    'summary': 'Core HRMS Module for Dayflow',
    'description': """
        Dayflow HRMS custom core module. Contains:
        - Organization setup (Geofencing configurations)
        - Employee Management (custom Employee ID, work mode, user automation)
        - HR/Admin Dashboard & Action Center
        - Attendance Management & exception/anomalies detection
        - Leave Management & Team availability features
        - Contract-based Payroll Structure
        - Employee Document Verification
        - Odoo native Reports & Security groups/rules
    """,
    'author': 'Dayflow Team',
    'depends': ['base', 'hr', 'hr_attendance', 'hr_holidays', 'mail'],
    'data': [
        'security/dayflow_security.xml',
        'security/ir.model.access.csv',
        'data/sequences.xml',
        'data/mail_templates.xml',
        'views/hr_employee_views.xml',
        'views/hr_attendance_views.xml',
        'views/attendance_correction_views.xml',
        'views/hr_leave_views.xml',
        'views/payroll_views.xml',
        'views/document_verification_views.xml',
        'views/hr_dashboard_views.xml',
        'views/reports_views.xml',
    ],
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
