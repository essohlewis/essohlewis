<?php

namespace App\Http\Requests;

use App\Enums\Market;
use App\Enums\Visibility;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePredictionRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Only an approved tipster may publish picks.
        return (bool) $this->user()?->isApprovedTipster();
    }

    public function rules(): array
    {
        return [
            'fixture_id' => ['required', 'integer', 'exists:fixtures,id'],
            'market' => ['required', Rule::enum(Market::class)],
            'selection' => ['required', 'string', 'max:40'],
            'odds' => ['required', 'numeric', 'min:1.01', 'max:1000'],
            'stake_units' => ['nullable', 'numeric', 'min:0.5', 'max:10'],
            'confidence' => ['nullable', 'integer', 'min:1', 'max:5'],
            'visibility' => ['required', Rule::enum(Visibility::class)],
            'analysis' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
