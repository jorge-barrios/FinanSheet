import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useCommitments } from '../context/CommitmentsContext';

interface ProfileSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const { trackingStartDate, refresh } = useCommitments();
    
    const [localDate, setLocalDate] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLocalDate(trackingStartDate || '');
        }
    }, [isOpen, trackingStartDate]);

    if (!isOpen || !user) return null;

    const handleSave = async () => {
        if (!supabase) return;
        setIsLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ tracking_start_date: localDate || null })
                .eq('id', user.id);

            if (error) throw error;
            
            showToast('Preferencias guardadas exitosamente', 'success');
            await refresh({ force: true, silent: true }); // Reload context with new date
            onClose();
        } catch (error) {
            console.error('Error updating profile:', error);
            showToast('Error al actualizar las preferencias', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />
            <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-800">
                <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                        Configuración del Perfil
                    </h2>
                </div>
                
                <div className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Fecha de Inicio de Monitoreo
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Selecciona desde qué fecha deseas empezar a ver los compromisos en la grilla y el reporte. Los compromisos anteriores a esta fecha figurarán como pendientes pero no en mora (virtuales). Si lo dejas vacío, se mostrarán desde su fecha de primer pago.
                        </p>
                        <input
                            type="date"
                            value={localDate}
                            onChange={(e) => setLocalDate(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 font-medium focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500 transition-all outline-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-5 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-sm shadow-sky-600/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center min-w-[100px]"
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            'Guardar'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
