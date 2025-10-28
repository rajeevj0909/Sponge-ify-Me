import React, { useState, useCallback, ChangeEvent, useRef, useEffect } from 'react';
import { editImage } from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { UploadIcon, SparklesIcon, UserIcon, SpongeIcon, CameraIcon, DownloadIcon } from './components/Icons';

interface OriginalImage {
  base64: string;
  mimeType: string;
  name: string;
}

const App: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<OriginalImage | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string>("Convert the face in the image into a SpongeBob-style face; however, the face should stay human. The face should look realistic and have subtle changes, like a slightly yellow face with a few holes, goofy teeth, bigger eyes, and a smile, while also keeping the background.");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            streamRef.current = stream;
          }
        })
        .catch(err => {
          console.error("Error accessing camera:", err);
          setError("Could not access the camera. Please check permissions and try again.");
          setIsCameraOpen(false);
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, [isCameraOpen]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please upload a valid image file (PNG, JPG, etc.).');
        return;
      }
      setError(null);
      setEditedImage(null);
      try {
        const base64 = await fileToBase64(file);
        setOriginalImage({
          base64: base64.split(',')[1],
          mimeType: file.type,
          name: file.name
        });
      } catch (err) {
        setError('Failed to read the image file.');
        setOriginalImage(null);
      }
    }
  };

  const handleTakePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        const base64 = dataUrl.split(',')[1];

        setOriginalImage({
          base64,
          mimeType: 'image/jpeg',
          name: `webcam-photo-${Date.now()}.jpg`
        });
        setEditedImage(null);
        setError(null);
        setIsCameraOpen(false);
      }
    }
  };

  const handleGenerateClick = useCallback(async () => {
    if (!originalImage || !prompt) {
      setError('Please upload an image and provide a prompt.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setEditedImage(null);
    try {
      const generatedImageBase64 = await editImage(originalImage.base64, originalImage.mimeType, prompt);
      if (generatedImageBase64) {
        setEditedImage(`data:image/png;base64,${generatedImageBase64}`);
      } else {
        throw new Error("The model did not return an image. Please try a different prompt.");
      }
    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [originalImage, prompt]);

  const handleDownload = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const ImagePlaceholder: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
    <div className="flex flex-col items-center justify-center w-full h-full bg-slate-100 dark:bg-slate-800 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400">
      {icon}
      <p className="mt-2 text-sm font-semibold">{text}</p>
    </div>
  );

  return (
    <>
      <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <header className="text-center mb-8">
            <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-600">
              Sponge-ify Me!
            </h1>
            <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
              Upload a photo and use AI to turn your face into a Spongebob character.
            </p>
          </header>

          <main className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="flex flex-col gap-6 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center">
                  <UserIcon className="w-6 h-6 mr-2" />
                  Your Photo
                </h2>
                <button
                  onClick={() => handleDownload(`data:${originalImage?.mimeType};base64,${originalImage?.base64}`, originalImage?.name || 'original.png')}
                  disabled={!originalImage}
                  className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Download original image"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-square w-full">
                {originalImage ? (
                  <img
                    src={`data:${originalImage.mimeType};base64,${originalImage.base64}`}
                    alt="Original upload"
                    className="w-full h-full object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <ImagePlaceholder icon={<UploadIcon className="w-12 h-12" />} text="Upload an Image or Use Camera" />
                )}
              </div>
              <div className="relative flex gap-2">
                <input
                  type="file"
                  id="file-upload"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <label
                  htmlFor="file-upload"
                  className="flex-1 flex items-center justify-center px-4 py-3 text-base font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer transition-colors"
                >
                  <UploadIcon className="w-5 h-5 mr-2" />
                  {originalImage ? 'Change Image' : 'Choose Image'}
                </label>
                <button
                  onClick={() => setIsCameraOpen(true)}
                  className="flex items-center justify-center px-4 py-3 text-base font-medium text-white bg-slate-600 border border-transparent rounded-md shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 cursor-pointer transition-colors"
                >
                  <CameraIcon className="w-5 h-5 mr-2" />
                  Camera
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200 flex items-center">
                  <SpongeIcon className="w-6 h-6 mr-2 text-yellow-500" />
                  Sponge-ified Result
                </h2>
                <button
                  onClick={() => handleDownload(editedImage!, 'sponge-ified.png')}
                  disabled={!editedImage || isLoading}
                  className="p-2 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Download edited image"
                >
                  <DownloadIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="aspect-square w-full">
                {isLoading ? (
                  <div className="flex items-center justify-center w-full h-full bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-yellow-500"></div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center w-full h-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-lg">
                    <p className="text-center">{error}</p>
                  </div>
                ) : editedImage ? (
                  <img
                    src={editedImage}
                    alt="Edited result"
                    className="w-full h-full object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <ImagePlaceholder icon={<SpongeIcon className="w-12 h-12 text-yellow-500" />} text="Your Result Appears Here" />
                )}
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="prompt" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Editing Prompt
                  </label>
                  <textarea
                    id="prompt"
                    rows={4}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Add a retro filter"
                  />
                </div>
                <button
                  onClick={handleGenerateClick}
                  disabled={isLoading || !originalImage}
                  className="flex items-center justify-center w-full px-4 py-3 text-base font-medium text-white bg-yellow-500 border border-transparent rounded-md shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors"
                >
                  <SparklesIcon className="w-5 h-5 mr-2" />
                  {isLoading ? 'Generating...' : 'Sponge-ify!'}
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex flex-col items-center justify-center z-50 p-4">
          <div className="relative bg-slate-800 p-4 rounded-lg shadow-2xl w-full max-w-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-md aspect-video object-cover bg-black"></video>
            <div className="mt-4 flex justify-center gap-4">
              <button onClick={handleTakePhoto} className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition-colors">
                Snap Photo
              </button>
              <button onClick={() => setIsCameraOpen(false)} className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </>
  );
};

export default App;