import {
  BarChart3,
  Bell,
  Circle,
  CircleHelp,
  Clock3,
  Globe,
  LogOut,
  Mail,
  MapPin,
  MessageSquareText,
  Monitor,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Settings,
  Sparkles,
  Users
} from "lucide-react";

const navItems = [
  { label: "Inbox", active: true, icon: MessageSquareText, badge: 12 },
  { label: "Contacts", active: false, icon: Users },
  { label: "Webhooks & Widgets", active: false, icon: Globe },
  { label: "Team", active: false, icon: Users },
  { label: "Canned replies", active: false, icon: Sparkles },
  { label: "Analytics", active: false, icon: BarChart3 },
  { label: "Settings", active: false, icon: Settings }
];

const conversations = [
  { name: "Michael Ramirez", time: "3:05 PM", preview: "Hey there, I want to buy one of your amazing products.", unread: 12, accent: "bg-[#d8846e]" },
  { name: "Patricia Adams", time: "2:48 PM", preview: "Sure. You can choose one of three colours...", unread: 0, accent: "bg-[#d5a072]" },
  { name: "Michael Ramirez", time: "2:15 PM", preview: "Cool. Can I buy with a discount? Is the promo still active?", unread: 0, accent: "bg-[#5b7eea]" },
  { name: "Sarah Creed", time: "1:42 PM", preview: "Is it okay for you?", unread: 0, accent: "bg-[#7d9a6b]" },
  { name: "Elizabeth Jenkins", time: "12:20 PM", preview: "Please help me to choose. And do you deliver...", unread: 0, accent: "bg-[#d397ae]" },
  { name: "Anna Smith", time: "11:05 AM", preview: "Thanks for your support!", unread: 0, accent: "bg-[#c1a07b]" },
  { name: "David Cooper", time: "10:32 AM", preview: "I have a question about the product.", unread: 0, accent: "bg-[#3d5dba]" },
  { name: "Lisa Wong", time: "09:18 AM", preview: "Can you send me the catalog?", unread: 0, accent: "bg-[#d78bb3]" }
];

const chatMessages = [
  { sender: "customer", text: "Hey there, I want to buy one of your amazing products.", time: "3:05 PM" },
  { sender: "agent", text: "Sure! You can choose one of three colours. Which one do you like most?", time: "3:05 PM" },
  { sender: "customer", text: "Cool. Can I buy with a discount? Is the promo still active?", time: "3:10 PM" }
];

export default function DashboardPage() {
  return (
    <main className="flex h-screen bg-[#f3f6fb] text-slate-800">
      <aside className="flex w-[245px] flex-col border-r border-[#dfe7f1] bg-[#f7fafc] px-4 py-4">
        <div className="flex items-center gap-3 px-2 pb-5 pt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#edf2ff] text-[#3f68ff] shadow-sm">
            <MessageSquareText size={18} strokeWidth={2.2} />
          </div>
          <div className="text-[17px] font-semibold tracking-tight text-slate-800">Relay Chat</div>
        </div>

        <nav className="mt-2 space-y-1.5">
          {navItems.map(({ label, active, icon: Icon, badge }) => (
            <button
              key={label}
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[15px] transition ${
                active
                  ? "bg-[#eaf2ff] text-[#2d64ff] shadow-sm ring-1 ring-[#dfe9ff]"
                  : "text-slate-700 hover:bg-slate-100/80"
              }`}
            >
              <Icon size={18} strokeWidth={2} className={active ? "text-[#2d64ff]" : "text-slate-500"} />
              <span className="flex-1 font-medium">{label}</span>
              {badge ? (
                <span className="rounded-full bg-[#e8f0ff] px-2 py-0.5 text-[11px] font-semibold text-[#3862f3]">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-2 border-t border-[#dfe7f1] pt-3">
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-slate-700 hover:bg-slate-100/80">
            <CircleHelp size={18} strokeWidth={2} className="text-slate-500" />
            <span className="flex-1 font-medium">Help & Support</span>
          </button>
          <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[15px] text-slate-700 hover:bg-slate-100/80">
            <LogOut size={18} strokeWidth={2} className="text-slate-500" />
            <span className="flex-1 font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] items-center justify-between border-b border-[#dfe7f1] bg-white/90 px-5">
          <div className="flex w-[46%] items-center gap-3 rounded-xl border border-[#dfe7f1] bg-[#f6f9fd] px-3 py-2.5 text-slate-500 shadow-[inset_0_1px_0_rgba(148,163,184,0.08)]">
            <Search size={17} className="text-slate-400" />
            <input
              aria-label="Search conversations"
              defaultValue=""
              placeholder="Search conversations..."
              className="w-full bg-transparent text-[14px] text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-4">
            <button type="button" aria-label="Notifications" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e1e7f1] bg-white text-slate-600 shadow-sm hover:bg-slate-50">
              <Bell size={18} />
            </button>
            <button type="button" className="flex items-center gap-2 rounded-full border border-[#e1e7f1] bg-white px-2 py-1.5 shadow-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#e9d4ca] to-[#b59fe7] text-[12px] font-semibold text-slate-800">
                S
              </div>
              <span className="pr-1 text-[14px] font-medium text-slate-700">Satyam Kumar</span>
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(260px,1.2fr)_minmax(420px,2.1fr)_minmax(250px,0.9fr)]">
          <aside className="border-r border-[#dfe7f1] bg-[#f8fafc]">
            <div className="flex items-center gap-5 border-b border-[#dfe7f1] bg-white px-4 py-3">
              <button type="button" className="rounded-full bg-[#eaf2ff] px-4 py-1.5 text-[13px] font-semibold text-[#2555ea]">
                All
              </button>
              <button type="button" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100">
                Unread
              </button>
              <button type="button" className="rounded-full px-3 py-1.5 text-[13px] font-medium text-slate-500 hover:bg-slate-100">
                Resolved
              </button>
            </div>

            <div className="max-h-[calc(100vh-150px)] overflow-y-auto">
              {conversations.map(({ name, time, preview, unread, accent }) => (
                <button
                  key={`${name}-${time}`}
                  type="button"
                  className={`flex w-full gap-3 border-b border-[#e9edf3] px-3 py-3 text-left transition hover:bg-slate-50 ${
                    name === "Michael Ramirez" && time === "3:05 PM" ? "border-l-4 border-l-[#2d64ff] bg-[#eef4ff]" : ""
                  }`}
                >
                  <div className="relative mt-1 h-11 w-11 shrink-0">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-full ${accent} text-[15px] font-semibold text-white`}>
                      {name.charAt(0)}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#4cd964]" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold text-slate-800">{name}</span>
                      <span className="shrink-0 text-[12px] text-slate-500">{time}</span>
                    </div>

                    <div className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-slate-600">{preview}</div>
                  </div>

                  {unread > 0 ? (
                    <span className="ml-auto mt-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#eaf2ff] px-1 text-[10px] font-bold text-[#2b63f5]">
                      {unread}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </aside>

          <main className="flex min-w-0 flex-col border-r border-[#dfe7f1] bg-white">
            <div className="flex items-center justify-between border-b border-[#dfe7f1] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d8e1ff] text-[15px] font-semibold text-slate-700">
                  M
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-slate-800">Michael Ramirez</div>
                  <div className="flex items-center gap-1 text-[12px] text-slate-500">
                    <span className="h-2 w-2 rounded-full bg-[#36c46f]" />
                    <span>Online</span>
                    <span className="text-slate-400">•</span>
                    <span>Customer</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e1e7f1] bg-white text-slate-600 hover:bg-slate-50">
                  <Search size={16} />
                </button>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e1e7f1] bg-white text-slate-600 hover:bg-slate-50">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>

            <div className="flex flex-1 flex-col justify-end gap-4 overflow-y-auto p-5">
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl bg-[#edf3f8] px-4 py-2.5 text-[15px] text-slate-700 shadow-sm">
                  Hey there, I want to buy one of your amazing products.
                </div>
              </div>

              <div className="flex justify-end">
                <div className="max-w-[78%] rounded-2xl bg-[#2c70ff] px-4 py-2.5 text-[15px] text-white shadow-sm">
                  Sure! You can choose one of three colours. Which one do you like most?
                </div>
              </div>

              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl bg-[#edf3f8] px-4 py-2.5 text-[15px] text-slate-700 shadow-sm">
                  Cool. Can I buy with a discount? Is the promo still active?
                </div>
              </div>
            </div>

            <div className="border-t border-[#dfe7f1] bg-white p-3">
              <div className="flex items-center gap-3 rounded-2xl border border-[#dfe7f1] bg-[#f9fbfd] px-3 py-2.5">
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200/70">
                  <Paperclip size={16} />
                </button>
                <input
                  aria-label="Type a message"
                  placeholder="Type a message..."
                  className="h-10 flex-1 bg-transparent text-[14px] text-slate-700 outline-none placeholder:text-slate-400"
                />
                <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2a67ff] text-white shadow-sm hover:bg-[#1f5af7]">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </main>

          <aside className="bg-[#f9fbfd] px-4 py-4">
            <div className="flex items-center gap-3 border-b border-[#dfe7f1] pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d8e1ff] text-[15px] font-semibold text-slate-700">
                M
              </div>
              <div>
                <div className="text-[15px] font-semibold text-slate-800">Michael Ramirez</div>
                <div className="flex items-center gap-1 text-[12px] text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-[#36c46f]" />
                  <span>Online</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-[13px] text-slate-700">
              <div className="flex items-center gap-3">
                <MapPin size={15} className="text-slate-400" />
                <span>New York, USA</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail size={15} className="text-slate-400" />
                <span>michael.ramirez@example.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Monitor size={15} className="text-slate-400" />
                <span>Chrome • Windows 11</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock3 size={15} className="text-slate-400" />
                <span>3:05 PM (Local time)</span>
              </div>
            </div>

            <div className="mt-6 border-t border-[#dfe7f1] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold text-slate-800">Tags</div>
                <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dfe7f1] bg-white text-slate-500">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#dfe7f1] bg-white px-3 py-1 text-[12px] font-medium text-slate-600">
                  Customer
                </span>
                <span className="rounded-full border border-[#dfe7f1] bg-white px-3 py-1 text-[12px] font-medium text-slate-600">
                  Premium
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-[#dfe7f1] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[15px] font-semibold text-slate-800">Previous conversations</div>
                <button type="button" className="text-slate-400">
                  <MoreHorizontal size={18} />
                </button>
              </div>
              <div className="rounded-xl border border-[#e4ebf3] bg-white px-3 py-5 text-center text-[13px] text-slate-400">
                No previous conversations
              </div>
            </div>

            <div className="mt-6 border-t border-[#dfe7f1] pt-4">
              <div className="text-[15px] font-semibold text-slate-800">Custom attributes</div>
              <div className="mt-3 space-y-3 text-[13px] text-slate-700">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">user id</span>
                  <span className="font-medium">#12345</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">plan</span>
                  <span className="font-medium">Premium</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">source</span>
                  <span className="font-medium">Website</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
