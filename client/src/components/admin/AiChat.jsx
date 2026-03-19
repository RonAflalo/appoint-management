import { useState, useRef, useEffect } from 'react';
import { sendAiMessage } from '../../api/admin';

export default function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]); // Claude API format
  const [bubbles, setBubbles] = useState([]);   // Display format
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [bubbles, open]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput('');

    const userBubble = { role: 'user', text };
    setBubbles(prev => [...prev, userBubble]);

    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const data = await sendAiMessage(newMessages);
      const replyText = data.reply;
      setBubbles(prev => [...prev, { role: 'assistant', text: replyText }]);
      setMessages(prev => [...prev, { role: 'assistant', content: replyText }]);
    } catch {
      setBubbles(prev => [...prev, { role: 'assistant', text: 'אירעה שגיאה, נסה שוב.', error: true }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const suggestions = [
    'אילו תורים יש היום?',
    'כמה הרווחנו החודש?',
    'מי הלקוח הכי פעיל?',
    'אילו תורים קרובים?',
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all"
        title="עוזר AI"
      >
        {open ? '✕' : '🤖'}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 left-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm">עוזר AI</p>
              <p className="text-xs text-indigo-200">שאל אותי כל שאלה על העסק</p>
            </div>
            <span className="text-xl">🤖</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: '200px' }}>
            {bubbles.length === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-400 text-center mb-3">לחץ על שאלה או כתוב בעצמך</p>
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="w-full text-right text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {bubbles.map((b, i) => (
              <div key={i} className={`flex ${b.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                  b.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-bl-sm'
                    : b.error
                      ? 'bg-red-50 text-red-700 rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-br-sm'
                }`}>
                  {b.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-end">
                <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-2xl rounded-br-sm text-sm">
                  <span className="animate-pulse">חושב...</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-100 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="שאל שאלה..."
              disabled={loading}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              שלח
            </button>
          </div>
        </div>
      )}
    </>
  );
}
