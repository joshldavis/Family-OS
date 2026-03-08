
import React, { useState, useEffect } from 'react';
import { ShoppingList, ShoppingItem, ShoppingCategory } from '../types';
import {
  ShoppingCart,
  Plus,
  X,
  CheckCircle2,
  Circle,
  Trash2,
  ChefHat,
  Package,
} from 'lucide-react';

interface ShoppingListsProps {
  shoppingLists: ShoppingList[];
  setShoppingLists: React.Dispatch<React.SetStateAction<ShoppingList[]>>;
}

const ALL_CATEGORIES: ShoppingCategory[] = [
  'Produce', 'Dairy', 'Meat & Seafood', 'Bakery', 'Pantry', 'Frozen', 'Beverages', 'Household', 'Other',
];

const CATEGORY_COLORS: Record<ShoppingCategory, string> = {
  'Produce': 'bg-green-50 text-green-700 border-green-100',
  'Dairy': 'bg-sky-50 text-sky-700 border-sky-100',
  'Meat & Seafood': 'bg-red-50 text-red-700 border-red-100',
  'Bakery': 'bg-amber-50 text-amber-700 border-amber-100',
  'Pantry': 'bg-orange-50 text-orange-700 border-orange-100',
  'Frozen': 'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Beverages': 'bg-purple-50 text-purple-700 border-purple-100',
  'Household': 'bg-slate-50 text-slate-700 border-slate-200',
  'Other': 'bg-slate-50 text-slate-600 border-slate-200',
};

const ShoppingLists: React.FC<ShoppingListsProps> = ({ shoppingLists, setShoppingLists }) => {
  const [activeListId, setActiveListId] = useState<string | null>(
    shoppingLists.length > 0 ? shoppingLists[0].id : null
  );
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ name: '', amount: '', category: 'Other' as ShoppingCategory });
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Sync activeListId when lists load after initial mount (e.g. from persistence)
  useEffect(() => {
    if (activeListId === null && shoppingLists.length > 0) {
      setActiveListId(shoppingLists[0].id);
    }
  }, [shoppingLists, activeListId]);

  const activeList = shoppingLists.find(l => l.id === activeListId);

  const createList = () => {
    if (!newListName.trim()) return;
    const list: ShoppingList = {
      id: `sl-${Date.now()}`,
      familyId: 'fam-1',
      name: newListName.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      items: [],
    };
    setShoppingLists(prev => [list, ...prev]);
    setActiveListId(list.id);
    setNewListName('');
    setIsCreating(false);
  };

  const deleteList = (id: string) => {
    setShoppingLists(prev => {
      const remaining = prev.filter(l => l.id !== id);
      if (activeListId === id) {
        setActiveListId(remaining.length > 0 ? remaining[0].id : null);
      }
      return remaining;
    });
  };

  const toggleItem = (itemId: string) => {
    setShoppingLists(prev => prev.map(l =>
      l.id !== activeListId ? l : {
        ...l,
        items: l.items.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i),
      }
    ));
  };

  const deleteItem = (itemId: string) => {
    setShoppingLists(prev => prev.map(l =>
      l.id !== activeListId ? l : {
        ...l,
        items: l.items.filter(i => i.id !== itemId),
      }
    ));
  };

  const addItem = () => {
    if (!newItemForm.name.trim()) return;
    const item: ShoppingItem = {
      id: `si-${Date.now()}`,
      name: newItemForm.name.trim(),
      amount: newItemForm.amount.trim(),
      category: newItemForm.category,
      checked: false,
    };
    setShoppingLists(prev => prev.map(l =>
      l.id !== activeListId ? l : { ...l, items: [...l.items, item] }
    ));
    setNewItemForm({ name: '', amount: '', category: 'Other' });
    setIsAddingItem(false);
  };

  const clearChecked = () => {
    setShoppingLists(prev => prev.map(l =>
      l.id !== activeListId ? l : { ...l, items: l.items.filter(i => !i.checked) }
    ));
  };

  // Group items by category
  const groupedItems = ALL_CATEGORIES.reduce((acc, cat) => {
    const items = activeList?.items.filter(i => i.category === cat) ?? [];
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {} as Record<ShoppingCategory, ShoppingItem[]>);

  const checkedCount = activeList?.items.filter(i => i.checked).length ?? 0;
  const totalCount = activeList?.items.length ?? 0;

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Shopping Lists</h1>
        <p className="text-slate-500 mt-1">Stay organized at the store with categorized grocery lists.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: List Selector */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Lists</p>
            <button
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700"
            >
              <Plus size={14} /> New List
            </button>
          </div>

          {isCreating && (
            <div className="flex gap-2 animate-in slide-in-from-top-2">
              <input
                autoFocus
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setIsCreating(false); }}
                className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="List name..."
              />
              <button onClick={createList} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700">
                Add
              </button>
            </div>
          )}

          {shoppingLists.length === 0 && !isCreating && (
            <div className="bg-slate-50 rounded-2xl p-6 text-center">
              <ShoppingCart size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No lists yet.</p>
              <p className="text-xs text-slate-400 mt-1">Create one or generate from Meal Planning.</p>
            </div>
          )}

          {shoppingLists.map(list => {
            const done = list.items.filter(i => i.checked).length;
            const total = list.items.length;
            return (
              <div
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setActiveListId(list.id); }}
                role="button"
                tabIndex={0}
                className={`group flex items-start justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  activeListId === list.id
                    ? 'bg-indigo-50 border-indigo-200'
                    : 'bg-white border-slate-100 hover:border-indigo-100 notion-shadow'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm truncate ${activeListId === list.id ? 'text-indigo-900' : 'text-slate-900'}`}>
                    {list.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">{list.createdAt} · {total} items</p>
                  {total > 0 && (
                    <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${(done / total) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                  className="ml-2 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right: Active List Items */}
        <div className="lg:col-span-2">
          {!activeList ? (
            <div className="bg-white border rounded-2xl p-16 text-center notion-shadow">
              <ShoppingCart size={40} className="text-slate-200 mx-auto mb-4" />
              <p className="text-slate-400 font-medium">Select a list to view items</p>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl overflow-hidden notion-shadow">
              {/* List header */}
              <div className="p-6 border-b bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-bold text-slate-900 text-lg">{activeList.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {checkedCount} of {totalCount} items checked
                      {totalCount > 0 && ` · ${Math.round((checkedCount / totalCount) * 100)}% done`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {checkedCount > 0 && (
                      <button
                        onClick={clearChecked}
                        className="text-xs font-bold text-slate-400 hover:text-red-600 px-3 py-1.5 border rounded-lg hover:border-red-200 hover:bg-red-50 transition-colors"
                      >
                        Clear Checked
                      </button>
                    )}
                    <button
                      onClick={() => setIsAddingItem(true)}
                      className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors"
                    >
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                {totalCount > 0 && (
                  <div className="w-full bg-slate-200 h-2 rounded-full mt-4 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${(checkedCount / totalCount) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Add item form */}
              {isAddingItem && (
                <div className="p-4 border-b bg-indigo-50/50 animate-in slide-in-from-top-2">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newItemForm.name}
                      onChange={e => setNewItemForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') addItem(); if (e.key === 'Escape') setIsAddingItem(false); }}
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Item name..."
                    />
                    <input
                      value={newItemForm.amount}
                      onChange={e => setNewItemForm(f => ({ ...f, amount: e.target.value }))}
                      className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Amount"
                    />
                    <select
                      value={newItemForm.category}
                      onChange={e => setNewItemForm(f => ({ ...f, category: e.target.value as ShoppingCategory }))}
                      className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={addItem} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700">Add</button>
                    <button onClick={() => setIsAddingItem(false)} className="text-slate-400 hover:text-slate-600">
                      <X size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Items grouped by category */}
              <div className="divide-y">
                {Object.keys(groupedItems).length === 0 ? (
                  <div className="p-12 text-center">
                    <Package size={32} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">This list is empty</p>
                    <p className="text-xs text-slate-400 mt-1">Add items manually or generate from Meal Planning.</p>
                  </div>
                ) : (
                  ALL_CATEGORIES.filter(cat => groupedItems[cat]).map(category => (
                    <div key={category}>
                      <div className="px-6 py-2 bg-slate-50/50">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[category]}`}>
                          {category}
                        </span>
                      </div>
                      {groupedItems[category].map(item => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors group"
                        >
                          <button
                            onClick={() => toggleItem(item.id)}
                            className="flex-shrink-0 text-slate-300 hover:text-green-500 transition-colors"
                          >
                            {item.checked
                              ? <CheckCircle2 size={22} className="text-green-500" />
                              : <Circle size={22} />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold transition-all ${item.checked ? 'line-through text-slate-300' : 'text-slate-800'}`}>
                              {item.name}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.amount && <span className="text-xs text-slate-400">{item.amount}</span>}
                              {item.recipeSource && (
                                <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-medium">
                                  <ChefHat size={9} /> {item.recipeSource}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-200 hover:text-red-400 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShoppingLists;
