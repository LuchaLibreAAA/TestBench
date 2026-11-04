import React from 'react';
import { Sheet } from '@/components/Sheet';
import { Palette, type PaletteProps } from './Palette';
import { Button } from '@/components/Button';
import { Send } from 'lucide-react';

export interface PaletteSheetProps extends PaletteProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
}

export const PaletteSheet: React.FC<PaletteSheetProps> = ({
  open,
  onClose,
  onSubmit,
  ...paletteProps
}) => {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Question Palette"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <Button variant="ghost" size="md" onClick={onClose}>
            Back to Test
          </Button>
          <Button
            variant="success"
            size="md"
            onClick={() => {
              onClose();
              onSubmit();
            }}
            icon={<Send className="w-4 h-4" />}
            className="flex-1 max-w-[200px]"
          >
            Submit Test
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <Palette
          {...paletteProps}
          showSectionHeaders={true}
          onGoTo={(qid) => {
            paletteProps.onGoTo(qid);
            onClose();
          }}
        />
      </div>
    </Sheet>
  );
};

