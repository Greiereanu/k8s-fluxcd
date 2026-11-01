import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { chatApi } from "../../api/client";
import { ChatMessage, ChatSessionDetail } from "../../types";
import { MessageSquare, X, Send, ShieldCheck } from "lucide-react";

export const ClientChatWidget: React.FC = () => {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<ChatSessionDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [adminTyping, setAdminTyping] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  // Load active session from API
  const loadSession = async () => {
    if (!token || user?.role !== "CLIENT") return;
    try {
      const data = await chatApi.getMySession();
      setSession(data);
      setMessages(data.messages);
      const unread = data.messages.filter((m) => !m.is_read && m.sender_role === "ADMIN").length;
      setUnreadCount(unread);
    } catch (e) {
      console.error("Failed to load chat session:", e);
    }
  };

  useEffect(() => {
    loadSession();
  }, [token, user]);

  // Manage WebSocket connection
  useEffect(() => {
    if (!token || user?.role !== "CLIENT") return;

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

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (!isOpen && data.sender_role === "ADMIN") {
            setUnreadCount((prev) => prev + 1);
          } else if (isOpen && data.sender_role === "ADMIN" && data.session_id) {
            chatApi.markSessionRead(data.session_id).catch(() => {});
          }
        } else if (data.type === "TYPING" && data.sender_role === "ADMIN") {
          setAdminTyping(data.is_typing);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.is_typing) {
            typingTimeoutRef.current = window.setTimeout(() => setAdminTyping(false), 3000);
          }
        } else if (data.type === "READ_RECEIPT") {
          setMessages((prev) =>
            prev.map((m) => (m.sender_role === "CLIENT" ? { ...m, is_read: true } : m))
          );
        }
      } catch (err) {
        console.error("Failed to parse chat message:", err);
      }
    };

    return () => {
      if (socketRef.current) {
        socketRef.current.close(1000, "Component unmounted");
        socketRef.current = null;
      }
    };
  }, [token, user, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setUnreadCount(0);
    if (session?.id) {
      chatApi.markSessionRead(session.id).catch(() => {});
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !socketRef.current) return;

    const payload = {
      type: "MESSAGE",
      session_id: session?.id,
      content: inputMessage.trim(),
    };

    socketRef.current.send(JSON.stringify(payload));
    setInputMessage("");
  };

  if (user?.role !== "CLIENT") return null;

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full shadow-2xl transition-all transform hover:scale-105"
          title="Customer Support Chat"
        >
          <MessageSquare className="w-5 h-5" />
          <span className="font-semibold text-sm">Need Help?</span>
          {unreadCount > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Floating Chat Modal Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Support Assistance</h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] text-slate-300">Support Desk Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>Welcome! Ask any questions regarding your energy metering devices or consumption limits.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_role === "CLIENT";
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                        isMe
                          ? "bg-blue-600 text-white rounded-br-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {isMe && (m.is_read ? " · Read" : " · Sent")}
                    </span>
                  </div>
                );
              })
            )}

            {adminTyping && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500 italic bg-white p-2 rounded-xl border border-slate-100 max-w-fit">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                <span className="ml-1 text-[11px]">Support is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="p-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-xl transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
