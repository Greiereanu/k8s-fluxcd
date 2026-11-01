import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { chatApi } from "../../api/client";
import { ChatMessage, ChatSessionSummary } from "../../types";
import {
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle,
  Inbox,
  Clock,
} from "lucide-react";

export const AdminChatCenter: React.FC = () => {
  const { user, token } = useAuth();
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [clientTyping, setClientTyping] = useState<Record<string, boolean>>({});

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await chatApi.getSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (e) {
      console.error("Failed to load chat sessions:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const loadSessionMessages = async (sessionId: string) => {
    try {
      const msgs = await chatApi.getSessionMessages(sessionId);
      setMessages(msgs);
      await chatApi.markSessionRead(sessionId);
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, unread_count: 0 } : s))
      );
    } catch (e) {
      console.error("Failed to load session messages:", e);
    }
  };

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionMessages(selectedSessionId);
    }
  }, [selectedSessionId]);

  // WebSocket for Admin
  useEffect(() => {
    if (!token || user?.role !== "ADMIN") return;

    const loc = window.location;
    const proto = loc.protocol === "https:" ? "wss:" : "ws:";
    const host = loc.port === "3000" ? `${loc.hostname}:8000` : loc.host;
    const wsUrl = `${proto}//${host}/ws/chat?token=${encodeURIComponent(token)}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "MESSAGE_RECEIVED") {
          const newMsg: ChatMessage = {
            id: data.message_id,
            session_id: data.session_id,
            sender_id: data.sender_id,
            sender_username: data.sender_username,
            sender_role: data.sender_role,
            content: data.content,
            is_read: data.is_read,
            timestamp: data.timestamp,
          };

          // If current open session matches, append message
          if (data.session_id === selectedSessionId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            chatApi.markSessionRead(data.session_id).catch(() => {});
          }

          // Update conversation list snippet & unread count
          setSessions((prev) => {
            const exists = prev.some((s) => s.id === data.session_id);
            if (!exists) {
              fetchSessions();
              return prev;
            }
            return prev.map((s) => {
              if (s.id === data.session_id) {
                const isSelected = s.id === selectedSessionId;
                return {
                  ...s,
                  last_message: newMsg,
                  updated_at: newMsg.timestamp,
                  unread_count: isSelected || data.sender_role === "ADMIN" ? 0 : s.unread_count + 1,
                };
              }
              return s;
            });
          });
        } else if (data.type === "TYPING") {
          setClientTyping((prev) => ({
            ...prev,
            [data.session_id]: data.is_typing,
          }));
        }
      } catch (err) {
        console.error("Failed to parse admin chat frame:", err);
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Admin chat center unmounted");
        socketRef.current = null;
      }
    };
  }, [token, user, selectedSessionId]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedSessionId || !socketRef.current) return;

    const payload = {
      type: "MESSAGE",
      session_id: selectedSessionId,
      content: inputMessage.trim(),
    };

    socketRef.current.send(JSON.stringify(payload));
    setInputMessage("");
  };

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex h-[650px]">
      {/* Left Pane: Conversations List */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-800">Support Inquiries</h3>
          </div>
          <button
            onClick={fetchSessions}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            title="Refresh Conversations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {sessions.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No customer support conversations yet.</p>
            </div>
          ) : (
            sessions.map((s) => {
              const isSelected = s.id === selectedSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedSessionId(s.id)}
                  className={`w-full text-left p-4 transition-colors flex items-start gap-3 ${
                    isSelected ? "bg-indigo-50/70 border-l-4 border-indigo-600" : "hover:bg-slate-100/60"
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-sm">
                    {s.client_username.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 truncate">
                        {s.client_username}
                      </span>
                      {s.unread_count > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
                          {s.unread_count}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {s.last_message ? s.last_message.content : "Started conversation"}
                    </p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {new Date(s.updated_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane: Active Thread */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedSession ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-sm">
                  {selectedSession.client_username.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {selectedSession.client_username}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Client UUID: {selectedSession.client_user_id}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-full flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Active Support Ticket
                </span>
              </div>
            </div>

            {/* Message Thread History */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
              {messages.map((m) => {
                const isAdmin = m.sender_role === "ADMIN";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isAdmin ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        isAdmin
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {isAdmin ? "Admin (You)" : m.sender_username} ·{" "}
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isAdmin && (m.is_read ? " · Read" : " · Delivered")}
                    </span>
                  </div>
                );
              })}

              {clientTyping[selectedSession.id] && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 italic bg-white p-2.5 rounded-xl border border-slate-200 max-w-fit">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="ml-1 text-[11px]">{selectedSession.client_username} is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply Composer */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-white border-t border-slate-200 flex items-center gap-3"
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder={`Reply to ${selectedSession.client_username}...`}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!inputMessage.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-medium text-sm flex items-center gap-2 transition-colors shadow-sm"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p>Select a conversation from the left to view customer inquiries.</p>
          </div>
        )}
      </div>
    </div>
  );
};
