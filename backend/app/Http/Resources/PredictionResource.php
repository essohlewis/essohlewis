<?php

namespace App\Http\Resources;

use App\Enums\Visibility;
use App\Models\Prediction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @property Prediction $resource
 */
class PredictionResource extends JsonResource
{
    private bool $hasAccess = false;

    public function withAccess(bool $hasAccess): static
    {
        $this->hasAccess = $hasAccess;

        return $this;
    }

    public function toArray(Request $request): array
    {
        /** @var Prediction $p */
        $p = $this->resource;

        $locked = $p->visibility === Visibility::Subscribers && ! $this->hasAccess && ! $p->isSettled();

        $fixture = $p->fixture;

        return [
            'id' => $p->id,
            'market' => $p->market,
            'visibility' => $p->visibility,
            'confidence' => $p->confidence,
            'odds' => $locked ? null : (float) $p->odds,
            'stake_units' => $locked ? null : (float) $p->stake_units,
            'selection' => $locked ? null : $p->selection,
            'analysis' => $locked ? null : $p->analysis,
            'locked' => $locked,
            'outcome' => $p->outcome,
            'created_at' => $p->created_at,
            'fixture' => $fixture ? [
                'id' => $fixture->id,
                'kickoff_at' => $fixture->kickoff_at,
                'status' => $fixture->status,
                'home' => $fixture->homeTeam?->name,
                'away' => $fixture->awayTeam?->name,
                'result' => $fixture->result,
            ] : null,
        ];
    }
}
