import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  ClipboardList, Apple, FileText, LogOut, CheckSquare, 
  Square, Plus, Trash2, ArrowLeft, History, Calendar, 
  Utensils, CupSoda, Sparkles, ShoppingCart 
} from 'lucide-react';

// Função para formatar a data de AAAA-MM-DD para DD/MM/AAAA
const formatDateBR = (dateString) => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  return `${day}/${month}/${year}`;
};

// Detalhes visuais e ícones de cada categoria
const getItemTypeDetails = (type) => {
  switch (type) {
    case 'alimentos':
      return {
        label: 'Alimento',
        bgColor: 'bg-amber-50/80 border-amber-200',
        textColor: 'text-amber-900',
        icon: <Utensils className="w-4 h-4 text-amber-600" />
      };
    case 'bebidas':
      return {
        label: 'Bebida',
        bgColor: 'bg-blue-50/80 border-blue-200',
        textColor: 'text-blue-900',
        icon: <CupSoda className="w-4 h-4 text-blue-600" />
      };
    case 'limpeza':
      return {
        label: 'Limpeza',
        bgColor: 'bg-purple-50/80 border-purple-200',
        textColor: 'text-purple-900',
        icon: <Sparkles className="w-4 h-4 text-purple-600" />
      };
    default:
      return {
        label: 'Alimento',
        bgColor: 'bg-slate-50 border-slate-200',
        textColor: 'text-slate-800',
        icon: <Utensils className="w-4 h-4 text-slate-500" />
      };
  }
};

export default function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [weeks, setWeeks] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [weekFilterTab, setWeekFilterTab] = useState('upcoming'); // 'upcoming' ou 'past'
  
  const [activeTab, setActiveTab] = useState('supermercado'); // 'supermercado', 'feira', 'notas'
  const [items, setItems] = useState([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [itemType, setItemType] = useState('alimentos'); // 'alimentos', 'bebidas', 'limpeza'
  const [noteText, setNoteText] = useState('');

  // 1. Controle de Sessão
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // 2. Buscar Semanas
  useEffect(() => {
    if (session) {
      fetchWeeks();
    }
  }, [session]);

  const fetchWeeks = async () => {
    const { data, error } = await supabase.from('weeks').select('*').order('week_number', { ascending: true });
    if (!error) setWeeks(data);
  };

  // 3. Carregar Dados da Semana Selecionada
useEffect(() => {
    if (selectedWeek && session?.user?.id) {
      fetchItems();
      fetchNotes();

      const channel = supabase
        .channel(`schema-db-changes-${selectedWeek.id}-${session.user.id}`)
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'list_items', filter: `week_id=eq.${selectedWeek.id}` }, 
          () => fetchItems()
        )
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'week_notes', filter: `week_id=eq.${selectedWeek.id}` }, 
          () => fetchNotes()
        )
        .subscribe();

      return () => supabase.removeChannel(channel);
    }
  }, [selectedWeek, session]);

  const fetchItems = async () => {
   if (!session?.user?.id) return;

   const { data } = await supabase
    .from('list_items')
    .select('*')
    .eq('week_id', selectedWeek.id)
    .eq('user_id', session.user.id) // 🔒 Filtra apenas os itens do usuário conectado
    .order('created_at', { ascending: true });

   if (data) setItems(data);
  };

  const fetchNotes = async () => {
   if (!session?.user?.id) return;

   const { data } = await supabase
    .from('week_notes')
    .select('notes')
    .eq('week_id', selectedWeek.id)
    .eq('user_id', session.user.id) // 🔒 Filtra as notas do usuário logado
    .maybeSingle();

   setNoteText(data ? data.notes : '');
  };

  // Ações do App
  const handleLogin = async (e) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    const { error } = await supabase.from('list_items').insert([{
      week_id: selectedWeek.id,
      category: activeTab,
      item_name: newItemName.trim(),
      quantity: newItemQty.trim(),
      item_type: itemType,
      user_id: session.user.id
    }]);

    if (!error) {
      setNewItemName('');
      setNewItemQty('');
      await fetchItems();
    } else {
      alert('Erro ao adicionar item: ' + error.message);
    }
  };

  const toggleItem = async (id, currentStatus) => {
    const { error } = await supabase
      .from('list_items')
      .update({ is_completed: !currentStatus })
      .eq('id', id);

    if (!error) {
      await fetchItems();
    } else {
      alert('Erro ao atualizar item: ' + error.message);
    }
  };

  const deleteItem = async (id) => {
    const { error } = await supabase
      .from('list_items')
      .delete()
      .eq('id', id);

    if (!error) {
      await fetchItems();
    } else {
      alert('Erro ao deletar item: ' + error.message);
    }
  };

  const saveNotes = async (text) => {
   setNoteText(text);
   if (!session?.user?.id) return;

   // Declaramos { error } corretamente para evitar o ReferenceError
   const { error } = await supabase
    .from('week_notes')
    .upsert(
      { 
        week_id: selectedWeek.id, 
        user_id: session.user.id, 
        notes: text 
      }, 
      { onConflict: 'week_id, user_id' } // 🔒 Garante o alinhamento com a chave única
    );

   if (error) {
    console.error('Erro detalhado ao salvar nota:', error.message);
   }
  };

  // Data de Hoje para Filtros
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;
  
  const upcomingWeeks = weeks.filter(w => w.end_date >= todayStr);
  const pastWeeks = weeks.filter(w => w.end_date < todayStr).reverse();

  const displayedWeeks = weekFilterTab === 'upcoming' ? upcomingWeeks : pastWeeks;

  // TELA DE LOGIN
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">Lista de Compras 📋</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold p-3 rounded-xl transition">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  // TELA 2: VISÃO DA SEMANA SELECIONADA
  if (selectedWeek) {
    // Ordem de exibição: Alimentos (1), Bebidas (2), Limpeza (3)
    const typePriority = { alimentos: 1, bebidas: 2, limpeza: 3 };

    const filteredItems = items
      .filter(i => i.category === activeTab)
      .sort((a, b) => (typePriority[a.item_type] || 1) - (typePriority[b.item_type] || 1));

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col max-w-md mx-auto border-x border-slate-200">
        {/* Topbar */}
        <header className="bg-white p-4 border-b flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <button onClick={() => setSelectedWeek(null)} className="flex items-center text-slate-600 font-medium hover:text-blue-600 transition">
            <ArrowLeft className="w-5 h-5 mr-1" /> Voltar
          </button>
          <div className="text-right">
            <span className="font-bold text-slate-800 block">Semana {String(selectedWeek.week_number).padStart(2, '0')}</span>
            <span className="text-xs text-slate-500">{formatDateBR(selectedWeek.start_date)} - {formatDateBR(selectedWeek.end_date)}</span>
          </div>
        </header>

        {/* Abas da Semana */}
        <nav className="flex bg-white border-b sticky top-[65px] z-10">
          <button onClick={() => setActiveTab('supermercado')} className={`flex-1 py-3 flex justify-center items-center gap-2 border-b-2 font-medium text-sm ${activeTab === 'supermercado' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}>
            <ShoppingCart className="w-4 h-4" /> Mercado
          </button>
          <button onClick={() => setActiveTab('feira')} className={`flex-1 py-3 flex justify-center items-center gap-2 border-b-2 font-medium text-sm ${activeTab === 'feira' ? 'border-green-600 text-green-600' : 'border-transparent text-slate-500'}`}>
            <Apple className="w-4 h-4" /> Feira
          </button>
          <button onClick={() => setActiveTab('notas')} className={`flex-1 py-3 flex justify-center items-center gap-2 border-b-2 font-medium text-sm ${activeTab === 'notas' ? 'border-amber-600 text-amber-600' : 'border-transparent text-slate-500'}`}>
            <FileText className="w-4 h-4" /> Notas
          </button>
        </nav>

        {/* Conteúdo da Lista */}
        <main className="flex-1 p-4 pb-36 overflow-y-auto">
          {activeTab === 'notas' ? (
            <textarea
              value={noteText}
              onChange={(e) => saveNotes(e.target.value)}
              placeholder="Digite aqui anotações, recados ou lembretes para a semana..."
              className="w-full h-64 p-4 border rounded-2xl bg-amber-50/50 border-amber-200 focus:outline-none text-slate-700 resize-none shadow-inner"
            />
          ) : (
            <div className="space-y-2.5">
              {filteredItems.length === 0 ? (
                <p className="text-center text-slate-400 text-sm py-8">Nenhum item adicionado nesta lista.</p>
              ) : (
                filteredItems.map((item) => {
                  const typeDetails = getItemTypeDetails(item.item_type);

                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-3 border rounded-xl shadow-sm transition ${typeDetails.bgColor}`}
                    >
                      <button onClick={() => toggleItem(item.id, item.is_completed)} className="flex items-center gap-3 text-left flex-1 pr-2">
                        {item.is_completed ? <CheckSquare className="w-5 h-5 text-green-600 shrink-0" /> : <Square className="w-5 h-5 text-slate-400 shrink-0" />}
                        <span className={`${item.is_completed ? 'line-through text-slate-400' : `${typeDetails.textColor} font-medium`}`}>
                          {item.item_name} {item.quantity && <span className="text-xs opacity-75 font-normal">({item.quantity})</span>}
                        </span>
                      </button>

                      <div className="flex items-center gap-2">
                        {/* Ícone da Categoria */}
                        <span title={typeDetails.label} className="p-1">
                          {typeDetails.icon}
                        </span>

                        {/* Botão Deletar */}
                        <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500 p-1 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>

        {/* Formulário Fixo Inferior com Seletor de Categoria */}
        {activeTab !== 'notas' && (
          <form onSubmit={handleAddItem} className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-3 bg-white border-t flex flex-col gap-2 shadow-lg z-20">
            {/* Seletor de Categoria */}
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setItemType('alimentos')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1 transition ${
                  itemType === 'alimentos' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Utensils className="w-3.5 h-3.5" /> Alimento
              </button>

              <button
                type="button"
                onClick={() => setItemType('bebidas')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1 transition ${
                  itemType === 'bebidas' ? 'bg-blue-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <CupSoda className="w-3.5 h-3.5" /> Bebida
              </button>

              <button
                type="button"
                onClick={() => setItemType('limpeza')}
                className={`flex-1 py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1 transition ${
                  itemType === 'limpeza' ? 'bg-purple-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" /> Limpeza
              </button>
            </div>

            {/* Inputs de Texto, Quantidade e Botão Adicionar */}
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Novo item..." 
                value={newItemName} 
                onChange={(e) => setNewItemName(e.target.value)} 
                className="flex-1 p-2.5 border rounded-xl text-sm outline-none border-slate-300 focus:border-blue-500" 
              />
              <input 
                type="text" 
                placeholder="Qtd" 
                value={newItemQty} 
                onChange={(e) => setNewItemQty(e.target.value)} 
                className="w-16 p-2.5 border rounded-xl text-sm outline-none border-slate-300 focus:border-blue-500 text-center" 
              />
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white p-2.5 rounded-xl font-medium transition">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // TELA 1: LISTA DE SEMANAS
  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto border-x border-slate-200 flex flex-col">
      <header className="bg-white p-4 border-b flex justify-between items-center sticky top-0 z-10 shadow-sm relative">
        <h1 className="font-bold text-lg text-slate-800 text-center w-full">Lista de Compras 📋</h1>
        <button onClick={() => supabase.auth.signOut()} title="Sair" className="text-slate-400 hover:text-red-600 transition p-1 absolute right-4">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      {/* Navegação entre Próximas e Anteriores */}
      <div className="p-3 bg-white border-b flex gap-2">
        <button
          onClick={() => setWeekFilterTab('upcoming')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            weekFilterTab === 'upcoming' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Atual e Próximas ({upcomingWeeks.length})
        </button>

        <button
          onClick={() => setWeekFilterTab('past')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            weekFilterTab === 'past' 
              ? 'bg-slate-800 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <History className="w-3.5 h-3.5" /> Anteriores ({pastWeeks.length})
        </button>
      </div>

      <main className="p-4 space-y-2.5 flex-1 overflow-y-auto">
        {displayedWeeks.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Nenhuma semana encontrada nesta aba.</p>
        ) : (
          displayedWeeks.map((w) => {
            const isCurrentWeek = todayStr >= w.start_date && todayStr <= w.end_date;

            return (
              <button
                key={w.id}
                onClick={() => setSelectedWeek(w)}
                className={`w-full text-left p-4 rounded-xl shadow-sm border transition flex justify-between items-center group relative ${
                  isCurrentWeek
                    ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-300/50 hover:bg-blue-100/70'
                    : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-md'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold block text-base transition ${
                      isCurrentWeek ? 'text-blue-900 font-bold' : 'text-slate-800 group-hover:text-blue-600'
                    }`}>
                      Semana {String(w.week_number).padStart(2, '0')}
                    </span>
                    
                    {isCurrentWeek && (
                      <span className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        Atual
                      </span>
                    )}
                  </div>

                  <span className={`text-xs mt-0.5 block ${isCurrentWeek ? 'text-blue-700 font-medium' : 'text-slate-500'}`}>
                    {formatDateBR(w.start_date)} até {formatDateBR(w.end_date)}
                  </span>
                </div>

                <span className={`text-xl font-bold transition ${isCurrentWeek ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-600'}`}>
                  &rsaquo;
                </span>
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}