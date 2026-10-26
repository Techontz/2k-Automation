<?php

namespace Database\Factories;

use App\Models\Channel;
use App\Models\Contact;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Contact>
 */
class ContactFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'channel_id' => Channel::factory(),
            'workspace_id' => fn (array $attributes) => Channel::find($attributes['channel_id'])->workspace_id,
            'platform' => fn (array $attributes) => Channel::find($attributes['channel_id'])->platform->value,
            'external_id' => (string) fake()->unique()->numerify('############'),
            'username' => fake()->userName(),
            'name' => fake()->name(),
        ];
    }

    public function messagedHoursAgo(int $hours): static
    {
        return $this->state(fn (): array => ['last_inbound_at' => now()->subHours($hours)]);
    }
}
