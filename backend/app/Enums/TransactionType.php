<?php

namespace App\Enums;

enum TransactionType: string
{
    case Topup = 'topup';
    case SubscriptionDebit = 'subscription_debit';
    case SubscriptionCredit = 'subscription_credit';
    case Commission = 'commission';
    case Payout = 'payout';
    case Refund = 'refund';
    case Tip = 'tip';
}
