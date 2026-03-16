
import Modal from '../../../components/base/Modal';
import Button from '../../../components/base/Button';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  formName: string;
  loading: boolean;
}

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, formName, loading }: DeleteConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Excluir Formulário" size="sm">
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <i className="ri-delete-bin-6-line text-2xl text-rose-500"></i>
        </div>
        <p className="text-sm text-gray-700 mb-1">
          Tem certeza que deseja excluir o formulário
        </p>
        <p className="text-sm font-semibold text-gray-900 mb-4">&quot;{formName}&quot;?</p>
        <p className="text-xs text-gray-500 mb-6">
          Esta ação não pode ser desfeita. Todas as respostas associadas também serão removidas.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={onConfirm} disabled={loading}>
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Excluindo...
              </>
            ) : (
              <>
                <i className="ri-delete-bin-6-line"></i>
                Excluir
              </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
