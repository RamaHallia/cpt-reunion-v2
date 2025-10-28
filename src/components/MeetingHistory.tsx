import { Calendar, Clock, FileText, Trash2, Loader2, Search, X, Mail, Edit2, Check, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { Meeting } from '../lib/supabase';
import { useState, useMemo, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ConfirmModal } from './ConfirmModal';

interface MeetingHistoryProps {
  meetings: Meeting[];
  onDelete: (id: string) => void;
  onView: (meeting: Meeting) => void;
  onSendEmail: (meeting: Meeting) => void;
  onUpdateMeetings: () => void;
  isLoading?: boolean;
}

const ITEMS_PER_PAGE = 10;

export const MeetingHistory = ({ meetings = [], onDelete, onView, onSendEmail, onUpdateMeetings, isLoading = false }: MeetingHistoryProps) => {
  const [searchTitle, setSearchTitle] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = localStorage.getItem('meetingHistoryPage');
    const page = saved ? parseInt(saved, 10) : 1;
    console.log('📄 MeetingHistory: Page initiale chargée depuis localStorage:', page);
    return page;
  });
  const [sentMeetingIds, setSentMeetingIds] = useState<Set<string>>(new Set());

  // Sauvegarder la page courante dans le localStorage
  useEffect(() => {
    console.log('💾 MeetingHistory: Sauvegarde page dans localStorage:', currentPage);
    localStorage.setItem('meetingHistoryPage', currentPage.toString());
  }, [currentPage]);

  // Charger les IDs des réunions qui ont des emails envoyés
  useEffect(() => {
    const loadSentEmails = async () => {
      if (!meetings || meetings.length === 0) return;

      const meetingIds = meetings.map(m => m.id);
      if (meetingIds.length === 0) return;

      const { data } = await supabase
        .from('email_history')
        .select('meeting_id')
        .in('meeting_id', meetingIds)
        .eq('status', 'sent');

      if (data) {
        const ids = new Set(data.map(item => item.meeting_id).filter(Boolean) as string[]);
        setSentMeetingIds(ids);
      }
    };

    loadSentEmails();

    // Écouter les nouveaux emails envoyés en temps réel
    const channel = supabase
      .channel('email_history_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'email_history',
          filter: `status=eq.sent`,
        },
        (payload: any) => {
          const newMeetingId = payload.new.meeting_id;
          if (newMeetingId && meetings.some(m => m.id === newMeetingId)) {
            setSentMeetingIds(prev => new Set([...prev, newMeetingId]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [meetings]);

  const filteredMeetings = useMemo(() => {
    if (!meetings || !Array.isArray(meetings)) return [];

    return meetings.filter((meeting) => {
      if (!meeting) return false;

      const matchesTitle = meeting.title?.toLowerCase().includes(searchTitle.toLowerCase()) ?? false;

      let matchesDate = true;
      if (searchDate && meeting.created_at) {
        const meetingDate = new Date(meeting.created_at).toISOString().split('T')[0];
        matchesDate = meetingDate === searchDate;
      }

      return matchesTitle && matchesDate;
    });
  }, [meetings, searchTitle, searchDate]);

  // Pagination
  const totalPages = Math.ceil(filteredMeetings.length / ITEMS_PER_PAGE);

  // Ajuster la page courante si elle dépasse le nombre total de pages
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedMeetings = filteredMeetings.slice(startIndex, endIndex);

  // Reset page quand les filtres changent
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTitle, searchDate]);
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditTitle = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setEditedTitle(meeting.title);
  };

  const handleSaveTitle = async (meetingId: string) => {
    if (!editedTitle.trim()) {
      alert('Le titre ne peut pas être vide');
      return;
    }

    try {
      const { error } = await supabase
        .from('meetings')
        .update({ title: editedTitle.trim() })
        .eq('id', meetingId);

      if (error) throw error;

      setEditingId(null);
      onUpdateMeetings(); // Recharger les réunions
    } catch (error) {
      console.error('Erreur lors de la mise à jour:', error);
      alert('Erreur lors de la mise à jour du titre');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditedTitle('');
  };

  const handleDeleteClick = (meetingId: string) => {
    setMeetingToDelete(meetingId);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (meetingToDelete) {
      setDeletingId(meetingToDelete);
      // Attendre la fin de l'animation (300ms)
      setTimeout(() => {
        onDelete(meetingToDelete);
        setDeletingId(null);
        setMeetingToDelete(null);
      }, 300);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 md:py-16">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Loader2 className="w-10 h-10 md:w-12 md:h-12 text-coral-500 animate-spin" />
        </div>
        <p className="text-cocoa-600 text-base md:text-lg font-medium">Chargement des réunions...</p>
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="text-center py-12 md:py-16">
        <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
          <Calendar className="w-10 h-10 md:w-12 md:h-12 text-coral-500" />
        </div>
        <p className="text-cocoa-600 text-base md:text-lg font-medium">Aucune réunion enregistrée</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="bg-gradient-to-br from-white to-orange-50/30 border-2 border-orange-100 rounded-xl md:rounded-2xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3 md:mb-4">
          <Search className="w-5 h-5 text-coral-500" />
          <h3 className="font-bold text-cocoa-800 text-base md:text-lg">Filtres de recherche</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Rechercher par titre..."
              value={searchTitle}
              onChange={(e) => setSearchTitle(e.target.value)}
              className="w-full px-4 py-2.5 md:py-3 pr-10 border-2 border-orange-200 rounded-lg md:rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all text-sm md:text-base"
            />
            {searchTitle && (
              <button
                onClick={() => setSearchTitle('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-coral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-4 py-2.5 md:py-3 pr-10 border-2 border-orange-200 rounded-lg md:rounded-xl focus:outline-none focus:border-coral-400 focus:ring-2 focus:ring-coral-100 transition-all text-sm md:text-base"
            />
            {searchDate && (
              <button
                onClick={() => setSearchDate('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-cocoa-400 hover:text-coral-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {(searchTitle || searchDate) && (
          <div className="mt-3 flex items-center justify-between text-sm text-cocoa-600">
            <span>
              {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''} trouvée{filteredMeetings.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setSearchTitle('');
                setSearchDate('');
              }}
              className="text-coral-500 hover:text-coral-600 font-medium transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {filteredMeetings.length === 0 ? (
        <div className="text-center py-12 md:py-16">
          <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-coral-100 to-sunset-100 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
            <Search className="w-10 h-10 md:w-12 md:h-12 text-coral-500" />
          </div>
          <p className="text-cocoa-600 text-base md:text-lg font-medium">Aucune réunion trouvée</p>
          <p className="text-cocoa-500 text-sm md:text-base mt-2">Essayez de modifier vos critères de recherche</p>
        </div>
      ) : (
        <>
        <div className="space-y-2 md:space-y-3">
          {paginatedMeetings.map((meeting) => (
        <div
          key={meeting.id}
          className={`bg-gradient-to-br from-white to-orange-50/30 border-2 border-orange-100 rounded-xl md:rounded-2xl overflow-hidden hover:border-coral-300 hover:shadow-lg transition-all ${
            deletingId === meeting.id ? 'animate-slideOut opacity-0 scale-95' : ''
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 p-4 md:p-5">
            <div
              className={`flex items-center gap-3 md:gap-4 flex-1 min-w-0 ${editingId !== meeting.id ? 'cursor-pointer hover:bg-orange-50/50' : ''} transition-colors -m-4 md:-m-5 p-4 md:p-5 rounded-l-xl md:rounded-l-2xl w-full sm:w-auto`}
              onClick={() => editingId !== meeting.id && onView(meeting)}
            >
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-coral-500 to-sunset-500 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg">
                <FileText className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>

              <div className="flex-1 min-w-0">
                {editingId === meeting.id ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTitle(meeting.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="w-full px-3 py-2 border-2 border-coral-300 rounded-lg font-bold text-cocoa-800 text-base md:text-lg focus:outline-none focus:border-coral-500 focus:ring-2 focus:ring-coral-200"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 mb-1 md:mb-1.5">
                    <h3 className="font-bold text-cocoa-800 text-base md:text-lg truncate">
                      {meeting.title}
                    </h3>
                    {sentMeetingIds.has(meeting.id) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full flex-shrink-0">
                        <Send className="w-3 h-3" />
                        Envoyé
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-5">
                  <span className="text-xs md:text-sm text-cocoa-600 font-medium truncate">
                    {formatDate(meeting.created_at)}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs md:text-sm text-cocoa-600 font-medium">
                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-sunset-500" />
                    <span>{formatDuration(meeting.duration)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 sm:ml-auto">
              {editingId === meeting.id ? (
                <>
                  <button
                    onClick={() => handleSaveTitle(meeting.id)}
                    className="p-2 md:p-2.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg md:rounded-xl transition-colors"
                    title="Enregistrer"
                  >
                    <Check className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-2 md:p-2.5 text-cocoa-400 hover:text-cocoa-600 hover:bg-cocoa-50 rounded-lg md:rounded-xl transition-colors"
                    title="Annuler"
                  >
                    <X className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditTitle(meeting);
                    }}
                    className="p-2 md:p-2.5 text-cocoa-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg md:rounded-xl transition-colors"
                    title="Modifier le titre"
                  >
                    <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendEmail(meeting);
                    }}
                    className="p-2 md:p-2.5 text-cocoa-400 hover:text-sunset-500 hover:bg-sunset-50 rounded-lg md:rounded-xl transition-colors"
                    title="Envoyer par email"
                  >
                    <Mail className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteClick(meeting.id);
                    }}
                    className="p-2 md:p-2.5 text-cocoa-400 hover:text-coral-500 hover:bg-coral-50 rounded-lg md:rounded-xl transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <div className="text-sm text-cocoa-600">
              Page {currentPage} sur {totalPages} • {filteredMeetings.length} réunion{filteredMeetings.length !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-coral-100 text-coral-700 hover:bg-coral-200"
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded-lg font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-coral-100 text-coral-700 hover:bg-coral-200"
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Modal de confirmation de suppression */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Supprimer cette réunion ?"
        message="Êtes-vous sûr de vouloir supprimer cette réunion ? Cette action est irréversible."
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setMeetingToDelete(null);
        }}
        confirmText="OK"
        cancelText="Annuler"
        isDangerous={true}
      />
    </div>
  );
};
