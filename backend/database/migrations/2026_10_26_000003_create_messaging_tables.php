<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_simulated')->default(false);
            $table->string('status', 20)->default('open');
            $table->boolean('needs_human')->default(false);
            $table->boolean('ai_paused')->default(false);
            $table->unsignedInteger('unread_count')->default(0);
            $table->text('last_message_preview')->nullable();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->unique(['channel_id', 'contact_id']);
            $table->index(['workspace_id', 'status', 'last_message_at']);
        });

        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('post_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('external_id');
            $table->string('parent_external_id')->nullable();
            $table->boolean('is_simulated')->default(false);
            $table->text('text');
            $table->string('matched_keyword')->nullable();
            $table->timestamp('commented_at');
            $table->timestamp('public_replied_at')->nullable();
            $table->timestamp('private_replied_at')->nullable();
            $table->timestamps();
            $table->unique(['channel_id', 'external_id']);
            $table->index(['workspace_id', 'commented_at']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('comment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedBigInteger('automation_run_id')->nullable()->index();
            $table->foreignId('sent_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('is_simulated')->default(false);
            $table->string('direction', 3);
            $table->string('kind', 20)->default('dm');
            $table->string('source', 20)->default('contact');
            $table->text('body')->nullable();
            $table->json('payload')->nullable();
            $table->string('status', 20)->default('received');
            $table->string('external_id')->nullable();
            $table->string('error_code', 40)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->index(['workspace_id', 'direction', 'status', 'created_at']);
            $table->index(['conversation_id', 'created_at']);
        });

        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('platform', 20);
            $table->string('dedupe_key', 191)->unique();
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_simulated')->default(false);
            $table->string('event_type', 40)->nullable();
            $table->json('payload');
            $table->string('status', 20)->default('received');
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->string('outcome')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            $table->index(['platform', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('conversations');
    }
};
