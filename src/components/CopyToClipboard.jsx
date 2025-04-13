import React from 'react';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { CopyIcon } from '@radix-ui/react-icons';

const CopyToClipboard = ({ targetRef, buttonText = "Copy to Clipboard", className = "" }) => {
  const copyToClipboard = async () => {
    try {
      if (!targetRef.current) {
        toast.error("Element not found");
        return;
      }

      const canvas = await html2canvas(targetRef.current);
      
      // Try using modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.write) {
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const item = new ClipboardItem({ "image/png": blob });
              await navigator.clipboard.write([item]);
              toast.success("Copied to clipboard!");
            } catch (err) {
              console.error("Clipboard write failed:", err);
              // Fallback: Offer download if clipboard fails
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'screenshot.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              toast.info("Downloaded as image (clipboard access denied)");
            }
          }
        });
      } else {
        // Fallback for browsers without Clipboard API support
        const url = canvas.toDataURL();
        const a = document.createElement('a');
        a.href = url;
        a.download = 'screenshot.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.info("Downloaded as image (clipboard not supported)");
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      toast.error("Failed to copy");
    }
  };

  return (
    <Button
      onClick={copyToClipboard}
      variant="outline"
      className={`flex items-center gap-2 ${className}`}
    >
      <CopyIcon className="h-4 w-4" />
      {buttonText}
    </Button>
  );
};

export default CopyToClipboard;
