import type { Message, Post, Run } from "@/lib/types";

/** Response of POST simulator/comment|message and GET simulator/conversation. */
export interface SimTimeline {
  contact: { id: number; username: string | null; email: string | null; tags: string[] } | null;
  event: { id: number; status: string; outcome: string | null; error: string | null } | null;
  comments: { id: number; text: string; matched_keyword: string | null; public_replied_at: string | null; private_replied_at: string | null; created_at: string }[];
  messages: Message[];
  runs: Run[];
}

export interface SimState {
  channel: { id: number; name: string; username: string | null };
  posts: Post[];
}
