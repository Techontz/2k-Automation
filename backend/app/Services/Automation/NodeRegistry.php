<?php

namespace App\Services\Automation;

use App\Services\Automation\Nodes\NodeHandler;

class NodeRegistry
{
    /** @var array<string, class-string<NodeHandler>> */
    public const Handlers = [
        'reply_comment' => Nodes\ReplyCommentNode::class,
        'send_message' => Nodes\SendMessageNode::class,
        'send_template' => Nodes\SendTemplateNode::class,
        'condition' => Nodes\ConditionNode::class,
        'split' => Nodes\SplitNode::class,
        'delay' => Nodes\DelayNode::class,
        'ai_reply' => Nodes\AiReplyNode::class,
        'add_tag' => Nodes\AddTagNode::class,
        'remove_tag' => Nodes\RemoveTagNode::class,
        'set_field' => Nodes\SetFieldNode::class,
        'collect_email' => Nodes\CollectEmailNode::class,
        'send_email' => Nodes\SendEmailNode::class,
        'handover' => Nodes\HandoverNode::class,
        'end' => Nodes\EndNode::class,
    ];

    public function for(string $type): ?NodeHandler
    {
        $class = self::Handlers[$type] ?? null;

        return $class ? app($class) : null;
    }
}
