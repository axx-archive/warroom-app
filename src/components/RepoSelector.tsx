"use client";

import { useState, useCallback } from "react";
import { fetchSubdirectories, validatePath } from "@/lib/actions";
import type { FileInfo } from "@/lib/fs-utils";

interface RepoSelectorProps {
  initialPath?: string;
  onSelect: (path: string) => void;
}

export function RepoSelector({ initialPath = "", onSelect }: RepoSelectorProps) {
  const [inputPath, setInputPath] = useState(initialPath);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState("~");
  const [subdirs, setSubdirs] = useState<FileInfo[]>([]);

  const handleValidate = useCallback(async (path: string) => {
    if (!path.trim()) {
      setIsValid(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await validatePath(path);

    if (result.success && result.data) {
      setIsValid(result.data.valid);
      if (!result.data.valid) {
        setError("Path is not a valid directory");
      }
    } else {
      setIsValid(false);
      setError(result.error || "Validation failed");
    }

    setIsLoading(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (isValid && inputPath.trim()) {
      onSelect(inputPath.trim());
    }
  }, [isValid, inputPath, onSelect]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
    setIsValid(null);
    setError(null);
  };

  const handleInputBlur = () => {
    handleValidate(inputPath);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      handleSubmit();
    }
  };

  const loadBrowserPath = async (path: string) => {
    setIsLoading(true);
    const result = await fetchSubdirectories(path);
    if (result.success && result.data) {
      setSubdirs(result.data);
      setBrowserPath(path);
    }
    setIsLoading(false);
  };

  const handleBrowseClick = () => {
    setShowBrowser(!showBrowser);
    if (!showBrowser) {
      loadBrowserPath(browserPath);
    }
  };

  const handleDirClick = (dir: FileInfo) => {
    loadBrowserPath(dir.path);
  };

  const handleSelectFromBrowser = () => {
    setInputPath(browserPath);
    setShowBrowser(false);
    handleValidate(browserPath);
  };

  const handleParentClick = () => {
    const parentPath = browserPath.replace(/\/[^/]+\/?$/, "") || "/";
    loadBrowserPath(parentPath);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputPath}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="Enter repo path (e.g., ~/Desktop/MyProject)"
            className={`w-full px-3 py-2 border rounded-md bg-white text-sm
              ${isValid === true ? "border-green-500" : ""}
              ${isValid === false ? "border-red-500" : ""}
              ${isValid === null ? "border-gray-300" : ""}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          />
          {isLoading && (
            <span className="absolute right-3 top-2 text-gray-400 text-sm">
              ...
            </span>
          )}
        </div>

        <button
          onClick={handleBrowseClick}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50"
        >
          Browse
        </button>

        <button
          onClick={handleSubmit}
          disabled={!isValid || isLoading}
          className={`px-4 py-2 rounded-md text-sm text-white
            ${isValid ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"}
          `}
        >
          Select
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {showBrowser && (
        <div className="border border-gray-300 rounded-md p-3 bg-gray-50">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
            <button
              onClick={handleParentClick}
              className="text-sm text-blue-600 hover:underline"
            >
              ..
            </button>
            <span className="text-sm text-gray-600 flex-1 truncate">
              {browserPath}
            </span>
            <button
              onClick={handleSelectFromBrowser}
              className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Select This
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {subdirs.length === 0 ? (
              <p className="text-sm text-gray-500">No subdirectories</p>
            ) : (
              subdirs.map((dir) => (
                <button
                  key={dir.path}
                  onClick={() => handleDirClick(dir)}
                  className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-200 rounded"
                >
                  {dir.name}/
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
