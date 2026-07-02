<?php

namespace App\Enums;

enum Market: string
{
    case Result1x2 = '1x2';
    case OverUnder = 'over_under';
    case Btts = 'btts';
    case Handicap = 'handicap';
}
