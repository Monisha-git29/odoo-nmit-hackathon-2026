# -*- coding: utf-8 -*-
from odoo import models, fields, api, _

class HrContract(models.Model):
    _inherit = 'hr.contract'

    basic_salary = fields.Float(
        string='Basic Salary',
        tracking=True,
        default=0.0
    )
    hra = fields.Float(
        string='HRA (House Rent Allowance)',
        tracking=True,
        default=0.0
    )
    allowances = fields.Float(
        string='Allowances',
        tracking=True,
        default=0.0
    )
    
    pf = fields.Float(
        string='Provident Fund (PF)',
        tracking=True,
        default=0.0
    )
    professional_tax = fields.Float(
        string='Professional Tax',
        tracking=True,
        default=0.0
    )
    other_deductions = fields.Float(
        string='Other Deductions',
        tracking=True,
        default=0.0
    )

    gross_salary = fields.Float(
        string='Gross Salary',
        compute='_compute_salaries',
        store=True,
        tracking=True
    )
    net_salary = fields.Float(
        string='Net Salary',
        compute='_compute_salaries',
        store=True,
        tracking=True
    )

    @api.depends('basic_salary', 'hra', 'allowances', 'pf', 'professional_tax', 'other_deductions')
    def _compute_salaries(self):
        for rec in self:
            rec.gross_salary = rec.basic_salary + rec.hra + rec.allowances
            rec.net_salary = rec.gross_salary - (rec.pf + rec.professional_tax + rec.other_deductions)
