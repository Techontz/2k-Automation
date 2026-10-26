<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('automations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('status', 20)->default('draft');
            $table->string('trigger_type', 40);
            $table->json('trigger_config');
            $table->json('flow');
            $table->unsignedInteger('priority')->default(100);
            $table->unsignedBigInteger('runs_count')->default(0);
            $table->unsignedBigInteger('completed_count')->default(0);
            $table->unsignedBigInteger('failed_count')->default(0);
            $table->timestamp('last_run_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['workspace_id', 'status', 'trigger_type']);
        });

        Schema::create('automation_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('workspace_id')->constrained()->cascadeOnDelete();
            $table->foreignId('automation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('conversation_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('comment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('webhook_event_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_simulated')->default(false);
            $table->string('status', 20)->default('running');
            $table->string('current_node_id', 64)->nullable();
            $table->string('waiting_for', 30)->nullable();
            $table->timestamp('resume_at')->nullable();
            $table->json('context')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['automation_id', 'status']);
            $table->index(['contact_id', 'status', 'waiting_for']);
            $table->index(['workspace_id', 'created_at']);
        });

        Schema::create('automation_run_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('automation_run_id')->constrained()->cascadeOnDelete();
            $table->string('node_id', 64);
            $table->string('node_type', 40);
            $table->string('status', 20);
            $table->text('summary')->nullable();
            $table->json('output')->nullable();
            $table->text('error')->nullable();
            $table->unsignedInteger('duration_ms')->default(0);
            $table->timestamp('created_at')->useCurrent();
            $table->index(['automation_run_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('automation_run_steps');
        Schema::dropIfExists('automation_runs');
        Schema::dropIfExists('automations');
    }
};
