
// components/LanhDaoBanModal.js
import { Dialog } from '@headlessui/react';

export default function LanhDaoBanModal({ isOpen, onClose, evaluationResult }) {
  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <Dialog.Panel className="bg-white p-6 rounded max-w-3xl w-full shadow-xl">
          <Dialog.Title className="text-lg font-bold mb-4">Đánh giá AI</Dialog.Title>
          <div className="max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded border">
            {evaluationResult}
          </div>
          <div className="mt-4 text-right">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Đóng
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}
