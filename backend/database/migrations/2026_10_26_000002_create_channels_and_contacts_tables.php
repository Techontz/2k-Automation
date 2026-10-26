<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('platform', 20);
            $table->boolean('is_simulated')->default(false);
            $table->string('external_id');
            $table->string('name');
            $table->string('username')->nullable();
            $table->string('avatar_url')->nullable();
            $table->text('access_token')->nullable();
            $table->timestamp('token_expires_at')->nullable();
            $table->json('scopes')->nullable();
            $table->string('status', 20)->default('connected');
            $table->string('status_reason')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('last_webhook_at')->nullable();
            $table->timestamps();
            $table->unique(['platform', 'external_id', 'workspace_id']);
            $table->index(['platform', 'external_id']);
        });

        Schema::create('posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->string('external_id');
            $table->string('media_type', 20)->default('post');
            $table->text('caption')->nullable();
            $table->string('permalink')->nullable();
            $table->string('thumbnail_url')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
            $table->unique(['channel_id', 'external_id']);
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->string('platform', 20);
            $table->string('external_id')->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->string('name')->nullable();
            $table->string('username')->nullable();
            $table->string('avatar_url')->nullable();
            $table->string('email')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('locale', 8)->nullable();
            $table->json('custom_fields')->nullable();
            $table->timestamp('last_inbound_at')->nullable();
            $table->timestamp('last_interaction_at')->nullable();
            $table->boolean('unsubscribed')->default(false);
            $table->timestamps();
            $table->unique(['channel_id', 'external_id']);
            $table->index(['workspace_id', 'last_interaction_at']);
            $table->index(['workspace_id', 'email']);
        });

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name', 60);
            $table->string('color', 9)->default('#5B3DF5');
            $table->timestamps();
            $table->unique(['workspace_id', 'name']);
        });

        Schema::create('contact_tag', function (Blueprint $table) {
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();
            $table->primary(['contact_id', 'tag_id']);
        });

        Schema::create('segments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->json('filters');
            $table->timestamps();
        });

        Schema::create('consents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->string('status', 10);
            $table->string('source', 40);
            $table->text('evidence')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('recorded_at');
            $table->timestamps();
            $table->index(['contact_id', 'type', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('consents');
        Schema::dropIfExists('segments');
        Schema::dropIfExists('contact_tag');
        Schema::dropIfExists('tags');
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('posts');
        Schema::dropIfExists('channels');
    }
};
