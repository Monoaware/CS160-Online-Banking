"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { validateCheckImage } from "@/app/lib/checks-client";

interface InternalAccount {
  id: number;
  account_number: string;
  account_type: "checking" | "savings";
  balance: number;
  is_active: boolean;
}

interface DepositResult {
  status: string;
  transaction_id?: number;
  amount?: number;
  validation_result?: {
    extracted_amount: number;
    routing_number?: string;
    account_number?: string;
    check_number?: string;
    payee_name?: string;
    payor_name?: string;
  };
  error?: string;
}

export function CheckDeposit() {
  const [accounts, setAccounts] = useState<InternalAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<DepositResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    fetchAccounts();
    return () => {
      // Cleanup camera stream on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const fetchAccounts = async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Not authenticated");
        return;
      }

      const response = await fetch("/api/accounts/internal", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = (await response.json()) as { error: { message: string } };
        throw new Error(data.error?.message || "Failed to fetch accounts");
      }

      const data = (await response.json()) as { accounts: InternalAccount[] };
      const activeAccounts = (data.accounts || []).filter(
        (acc) => acc.is_active,
      );
      setAccounts(activeAccounts);

      // Auto-select first checking account if available
      const checkingAccounts = activeAccounts.filter(
        (acc) => acc.account_type === "checking",
      );
      if (checkingAccounts.length > 0) {
        setSelectedAccount(checkingAccounts[0].account_number);
      } else if (activeAccounts.length > 0) {
        // Fallback to first account if no checking account exists
        setSelectedAccount(activeAccounts[0].account_number);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    }
  };

  const handleFileSelect = async (file: File) => {
    setError(null);
    setSuccess(null);

    // Validate file
    const validation = await validateCheckImage(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid image file");
      return;
    }

    setImageFile(file);

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to access camera. Please check permissions.",
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "check-photo.jpg", {
          type: "image/jpeg",
        });
        handleFileSelect(file);
        stopCamera();
      }
    }, "image/jpeg");
  };

  const handleUpload = async () => {
    if (!imageFile || !selectedAccount) {
      setError("Please select an account and upload a check image");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setUploading(true);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Not authenticated");
      }

      // Upload image
      const formData = new FormData();
      formData.append("file", imageFile);

      const uploadResponse = await fetch("/api/checks/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = (await uploadResponse.json()) as { error: string };
        throw new Error(errorData.error || "Failed to upload image");
      }

      const uploadData = (await uploadResponse.json()) as {
        image_url: string;
        upload_id: string;
      };

      // Process deposit
      setUploading(false);
      setProcessing(true);

      const depositResponse = await fetch("/api/checks/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          check_image_url: uploadData.image_url,
          destination_account_number: selectedAccount,
        }),
      });

      const depositData = (await depositResponse.json()) as DepositResult;

      if (!depositResponse.ok) {
        throw new Error(depositData.error || "Failed to process check deposit");
      }

      setSuccess(depositData);
      setImageFile(null);
      setImagePreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process check");
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deposit Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Select Account
            </label>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger>
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.account_number}>
                    {account.account_type.charAt(0).toUpperCase() +
                      account.account_type.slice(1)}{" "}
                    - {account.account_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image Upload Section */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Check Image
            </label>

            {!imagePreview && !cameraActive && (
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Image
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={startCamera}
                    className="flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            )}

            {cameraActive && (
              <div className="space-y-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopCamera}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={capturePhoto}
                    className="flex-1"
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Capture
                  </Button>
                </div>
              </div>
            )}

            {imagePreview && (
              <div className="space-y-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
                    alt="Check preview"
                    className="h-full w-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="absolute right-2 top-2"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="flex items-center gap-2 rounded-md bg-destructive/20 border border-destructive/50 p-4 text-sm text-destructive"
              role="alert"
            >
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              className="flex items-center gap-2 rounded-md bg-green-500/20 border border-green-500/50 p-4 text-sm text-green-700 dark:text-green-400"
              role="alert"
            >
              <CheckCircle2 className="h-4 w-4" />
              <div className="flex-1">
                <p className="font-medium">{success.status}</p>
                {success.amount && (
                  <p className="mt-1 text-xs">
                    Amount: {formatCurrency(success.amount)}
                  </p>
                )}
                {success.validation_result && (
                  <div className="mt-2 space-y-1 text-xs">
                    {success.validation_result.payor_name && (
                      <p>From: {success.validation_result.payor_name}</p>
                    )}
                    {success.validation_result.routing_number && (
                      <p>Routing: {success.validation_result.routing_number}</p>
                    )}
                    {success.validation_result.account_number && (
                      <p>Account: {success.validation_result.account_number}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleUpload}
            disabled={!imageFile || !selectedAccount || uploading || processing}
            className="w-full"
          >
            {uploading || processing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {uploading ? "Uploading..." : "Processing..."}
              </>
            ) : (
              "Deposit Check"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
