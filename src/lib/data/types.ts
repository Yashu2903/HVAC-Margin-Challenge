export type Contract = {
    project_id: string;
    project_name: string;
    original_contract_value: string;

};

export type Laborlog = {
    project_id: string;
    hours_st: string;
    hours_ot: string;
    hourly_rate: string;
    burden_multiplier: string;
};

export type MaterialDelivery = {
    project_id: string;
    total_cost: string;
};

export type BillingHistory = {
    project_id: string;
    cumulative_billed: string;
};

export type ChangeOrder = {
    project_id: string;
    amount: string;
    status: string;
    description?: string;
};

export type RFI = {
    project_id: string;
    status: string;
    cost_impact: string;
    subject?: string;
};

export type FieldNote = {
    project_id: string;
    content: string;
    date: string;
};

export type SOVLine = {
    project_id: string;
    sov_line_id: string;
    scheduled_value: string;
};

export type BillingLineItem = {
    sov_line_id: string;
    project_id?: string;
    application_number?: string;
    scheduled_value: string;
    pct_complete: string;
    total_billed: string;
};