<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MessageResource;
use App\Models\Comment;
use App\Services\Messaging\MessageDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $comments = Comment::forWorkspace($this->workspace($request))
            ->with(['contact:id,username,name,avatar_url', 'post:id,caption,media_type,permalink,thumbnail_url', 'channel:id,name,platform,is_simulated'])
            ->when($request->query('channel_id'), fn ($query, $id) => $query->where('channel_id', $id))
            ->when($request->query('post_id'), fn ($query, $id) => $query->where('post_id', $id))
            ->when($request->query('filter') === 'matched', fn ($query) => $query->whereNotNull('matched_keyword'))
            ->when($request->query('filter') === 'unanswered', fn ($query) => $query->whereNull('public_replied_at')->whereNull('private_replied_at'))
            ->when($request->query('search'), fn ($query, $search) => $query->where('text', 'like', "%{$search}%"))
            ->latest('commented_at')
            ->paginate(30);

        $comments->getCollection()->transform(function (Comment $comment): array {
            $privateWindowOpen = $comment->private_replied_at === null && $comment->commented_at->greaterThan(now()->subDays(7));

            return [
                ...$comment->toArray(),
                'private_reply_available' => $privateWindowOpen && $comment->channel->platform->capabilities()['private_reply'],
                'private_reply_expires_at' => $comment->commented_at->copy()->addDays(7),
            ];
        });

        return response()->json($comments);
    }

    public function reply(Request $request, int $comment, MessageDispatcher $dispatcher): MessageResource
    {
        $this->authorizeAbility($request, 'inbox.reply');
        $model = Comment::forWorkspace($this->workspace($request))->with(['channel', 'contact'])->findOrFail($comment);
        $data = $request->validate(['text' => ['required', 'string', 'max:2000']]);

        return new MessageResource($dispatcher->replyToComment($model, $data['text'], ['source' => 'user', 'user_id' => $request->user()->id]));
    }
}
