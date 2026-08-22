# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError

class EmployeeDocument(models.Model):
    _name = 'dayflow.employee.document'
    _description = 'Employee Document'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'create_date desc'

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        tracking=True
    )
    document_name = fields.Char(
        string='Document Name',
        required=True,
        tracking=True
    )
    document_type = fields.Selection([
        ('resume', 'Resume'),
        ('certificate', 'Certificate'),
        ('other', 'Other Document')
    ], string='Document Type', required=True, default='other', tracking=True)
    
    file = fields.Binary(
        string='File Content',
        attachment=True,
        required=True
    )
    file_filename = fields.Char(
        string='File Name'
    )
    status = fields.Selection([
        ('pending', 'Pending Verification'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], string='Status', default='pending', tracking=True)
    
    remark = fields.Text(
        string='Verification Remark',
        tracking=True
    )
    verified_by = fields.Many2one(
        'res.users',
        string='Verified By',
        readonly=True,
        tracking=True
    )
    verified_at = fields.Datetime(
        string='Verified At',
        readonly=True,
        tracking=True
    )

    def action_approve(self):
        self.ensure_one()
        if self.status != 'pending':
            raise UserError(_("Only pending documents can be verified/approved."))
        
        self.write({
            'status': 'approved',
            'verified_by': self.env.user.id,
            'verified_at': fields.Datetime.now()
        })
        
        self.message_post(body=_("Document '%s' has been APPROVED by %s.") % (self.document_name, self.env.user.name))
        self.employee_id.message_post(
            body=_("Your document '%s' has been APPROVED by HR.") % self.document_name
        )

    def action_reject(self):
        self.ensure_one()
        if self.status != 'pending':
            raise UserError(_("Only pending documents can be rejected."))
            
        self.write({
            'status': 'rejected',
            'verified_by': self.env.user.id,
            'verified_at': fields.Datetime.now()
        })

        self.message_post(body=_("Document '%s' has been REJECTED by %s. Remark: %s") % (self.document_name, self.env.user.name, self.remark or 'No remark.'))
        self.employee_id.message_post(
            body=_("Your document '%s' has been REJECTED by HR. Remark: %s") % (self.document_name, self.remark or 'No remark.')
        )
