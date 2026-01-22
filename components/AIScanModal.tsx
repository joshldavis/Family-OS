
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { X, Sparkles, Upload, FileText, Loader2, Check, AlertCircle } from 'lucide-react';

interface AIScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  context: 'finance' | 'schoolwork' | 'chores';
  onDataExtracted: (data: any) => void;
  students?: { id: string, name: string }[];
  users?: { id: string, name: string }[];
}

const AIScanModal: React.FC<AIScanModalProps> = ({ 
  isOpen, 
  onClose, 
  context, 
  onDataExtracted,
  students = [],
  users = []
}) => {
  const [inputMode, setInputMode] = useState<'upload' | 'text'>('upload');
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processWithAI = async (content: string | { data: string, mimeType: string }) => {
    setIsProcessing(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const today = new Date().toISOString().split('T')[0];
      
      let systemInstruction = `Today's date is ${today}. `;
      let responseSchema: any = {};

      if (context === 'finance') {
        systemInstruction += "You are a receipt OCR assistant. Extract the vendor name, total amount, date (YYYY-MM-DD), and a category (Groceries, Housing, Transport, Entertainment, Utilities, Other). If the date is missing, use today's date. Return JSON.";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            date: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ["description", "amount", "date", "category"]
        };
      } else if (context === 'schoolwork') {
        systemInstruction += `Extract school assignments. Return an array. For each, find title, subject, and dueDate (YYYY-MM-DD). Use today's date (${today}) as reference for relative dates like 'due tomorrow'. If a student name is mentioned, try to match it with these students: ${students.map(s => s.name).join(', ')}. Return JSON.`;
        responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              subject: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              studentName: { type: Type.STRING }
            },
            required: ["title", "subject", "dueDate"]
          }
        };
      } else {
        systemInstruction += `Extract household chores. Return an array of tasks. For each, find a title and dueDate (YYYY-MM-DD). Use today's date (${today}) as reference. If an assignee is mentioned, match with: ${users.map(u => u.name).join(', ')}. Return JSON.`;
        responseSchema = {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              dueDate: { type: Type.STRING },
              assigneeName: { type: Type.STRING }
            },
            required: ["title", "dueDate"]
          }
        };
      }

      const parts: any[] = [];
      if (typeof content === 'string') {
        parts.push({ text: `Process the following unstructured text for ${context}: ${content}` });
      } else {
        parts.push({ inlineData: content });
        parts.push({ text: `Perform OCR and extract structured ${context} data from this image. Ensure the date is in YYYY-MM-DD format.` });
      }

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts }],
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
          systemInstruction: systemInstruction
        }
      });

      const extracted = JSON.parse(result.text || "{}");
      onDataExtracted(extracted);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Failed to process content. Please try again with clearer text or a better image.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      processWithAI({ data: base64Data, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b flex justify-between items-center bg-indigo-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Magic AI Scan</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-8">
          {isProcessing ? (
            <div className="py-12 flex flex-col items-center justify-center text-center">
              <div className="relative">
                <Loader2 size={48} className="text-indigo-600 animate-spin" />
                <Sparkles size={20} className="text-indigo-400 absolute -top-2 -right-2 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-6">Magic in progress...</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-xs">Gemini is reading your content and turning it into structured family data.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button 
                  onClick={() => setInputMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'upload' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  <Upload size={16} /> Image OCR
                </button>
                <button 
                  onClick={() => setInputMode('text')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'text' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
                >
                  <FileText size={16} /> Paste Text
                </button>
              </div>

              {inputMode === 'upload' ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={32} className="text-slate-300 group-hover:text-indigo-500" />
                  </div>
                  <p className="font-bold text-slate-900">Upload {context === 'finance' ? 'Receipt' : 'List'}</p>
                  <p className="text-xs text-slate-400 mt-1">Supports PNG, JPG (Max 5MB)</p>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleFileUpload}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <textarea 
                    className="w-full h-40 p-4 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none text-sm"
                    placeholder={`Paste text from ${context === 'schoolwork' ? 'a teacher email' : 'a text message'}...`}
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                  <button 
                    disabled={!textInput.trim()}
                    onClick={() => processWithAI(textInput)}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <Sparkles size={18} />
                    Process with Gemini
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-center gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIScanModal;
