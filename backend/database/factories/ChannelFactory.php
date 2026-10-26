<?php

namespace Database\Factories;

use App\Models\Channel;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Channel>
 */
class ChannelFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'platform' => 'instagram',
            'is_simulated' => false,
            'external_id' => (string) fake()->unique()->numerify('178414########'),
            'name' => fake()->userName(),
            'username' => fake()->userName(),
            'access_token' => 'test-token-'.fake()->sha1(),
            'token_expires_at' => now()->addDays(50),
            'status' => 'connected',
        ];
    }

    public function simulated(): static
    {
        return $this->state(fn (): array => ['is_simulated' => true, 'access_token' => null]);
    }

    public function platform(string $platform): static
    {
        return $this->state(fn (): array => ['platform' => $platform]);
    }
}
