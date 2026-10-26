<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_providers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('driver', 20);
            $table->string('name');
            $table->string('from_name');
            $table->string('from_email');
            $table->text('credentials')->nullable();
            $table->boolean('is_default')->default(false);
            $table->string('status', 20)->default('active');
            $table->timestamps();
        });

        Schema::create('email_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('subject');
            $table->longText('body_html');
            $table->text('body_text')->nullable();
            $table->string('category', 20)->default('marketing');
            $table->timestamps();
        });

        Schema::create('email_campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_template_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_provider_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->json('audience')->nullable();
            $table->string('status', 20)->default('draft');
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->unsignedInteger('recipients_count')->default(0);
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->timestamps();
        });

        Schema::create('email_sends', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_campaign_id')->nullable()->constrained()->cascadeOnDelete();
            $table->foreignId('email_template_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('automation_run_id')->nullable();
            $table->string('to_email');
            $table->string('subject');
            $table->string('status', 20)->default('queued');
            $table->text('error')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamps();
            $table->unique(['email_campaign_id', 'contact_id']);
            $table->index(['workspace_id', 'status', 'created_at']);
        });

        Schema::create('ai_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->unique()->constrained()->cascadeOnDelete();
            $table->boolean('enabled')->default(false);
            $table->string('provider', 20)->default('anthropic');
            $table->string('model')->nullable();
            $table->text('api_key')->nullable();
            $table->string('assistant_name')->default('Assistant');
            $table->text('brand_voice')->nullable();
            $table->json('languages');
            $table->decimal('confidence_threshold', 3, 2)->default(0.70);
            $table->json('handover_keywords')->nullable();
            $table->text('extra_instructions')->nullable();
            $table->boolean('auto_reply_dms')->default(false);
            $table->timestamps();
        });

        Schema::create('knowledge_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->text('content');
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('knowledge_items');
        Schema::dropIfExists('ai_settings');
        Schema::dropIfExists('email_sends');
        Schema::dropIfExists('email_campaigns');
        Schema::dropIfExists('email_templates');
        Schema::dropIfExists('email_providers');
    }
};
