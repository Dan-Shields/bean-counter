// Database types

export type TransactionType = 'expense' | 'repayment' | 'income';

export interface Group {
    id: string;
    name: string;
    default_currency: string;
    created_at: string;
}

export interface Member {
    id: string;
    group_id: string;
    name: string;
    created_at: string;
}

export interface Transaction {
    id: string;
    group_id: string;
    type: TransactionType;
    title: string;
    date: string;
    category?: string;
    amount: number;
    currency: string;
    base_currency_amount?: number;
    payer_id: string;
    deleted_at?: string;
    created_at: string;
    updated_at: string;
}

export interface TransactionSplit {
    id: string;
    transaction_id: string;
    member_id: string;
    parts?: number;
    exact_amount?: number;
    created_at: string;
}

export interface TransactionChangelog {
    id: string;
    transaction_id: string;
    action: 'created' | 'updated' | 'deleted';
    changed_fields?: Record<string, unknown>;
    changed_at: string;
}

// Full transaction with related data
export interface TransactionWithDetails extends Transaction {
    payer: Member;
    splits: (TransactionSplit & { member: Member })[];
}

// Balance calculation types
export interface MemberBalance {
    member_id: string;
    member_name: string;
    balance: number; // positive = owed money, negative = owes money
}

export interface Settlement {
    from_member_id: string;
    from_member_name: string;
    to_member_id: string;
    to_member_name: string;
    amount: number;
}

// Form types
export interface TransactionFormData {
    type: TransactionType;
    title: string;
    date: string;
    category?: string;
    amount: number;
    currency: string;
    payer_id: string;
    splits: {
        member_id: string;
        parts?: number;
        exact_amount?: number;
        enabled: boolean; // for the checkbox in UI
    }[];
}

// Local storage types
export interface UserGroupMembership {
    group_id: string;
    member_id: string; // which member in the group represents this user
}
