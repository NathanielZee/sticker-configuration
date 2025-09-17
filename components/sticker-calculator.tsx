"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const RATE_PER_M2 = 200

const discountTiers = [
  { min: 1, max: 9, discount: 0 },
  { min: 10, max: 24, discount: 0.1 },
  { min: 25, max: 49, discount: 0.2 },
  { min: 50, max: 99, discount: 0.3 },
  { min: 100, max: 249, discount: 0.4 },
  { min: 250, max: 499, discount: 0.5 },
  { min: 500, max: 999, discount: 0.55 },
  { min: 1000, max: Number.POSITIVE_INFINITY, discount: 0.6 },
]

const sizes = [
  { label: "50 × 50 mm", width: 50, height: 50 },
  { label: "75 × 75 mm", width: 75, height: 75 },
  { label: "100 × 100 mm", width: 100, height: 100 },
  { label: "125 × 125 mm", width: 125, height: 125 },
  { label: "150 × 150 mm", width: 150, height: 150 },
]

function getDiscountRate(qty: number) {
  const tier = discountTiers.find((t) => qty >= t.min && qty <= t.max)
  return tier ? tier.discount : 0
}

export default function StickerCalculator() {
  const [selectedSize, setSelectedSize] = useState<(typeof sizes)[0] | null>(null)
  const [customWidth, setCustomWidth] = useState<number | null>(null)
  const [customHeight, setCustomHeight] = useState<number | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState<number | null>(null)
  const [customQuantity, setCustomQuantity] = useState<number | null>(null)
  const [showCustomSize, setShowCustomSize] = useState(false)
  const [showCustomQuantity, setShowCustomQuantity] = useState(false)
  const [selectedFinish, setSelectedFinish] = useState("")
  const [isReorder, setIsReorder] = useState(false)
  const [invoiceNumber, setInvoiceNumber] = useState("")
  const [artworkMethod, setArtworkMethod] = useState("")
  const [shippingMethod, setShippingMethod] = useState("13.95")
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [currentStep, setCurrentStep] = useState<"configure" | "details">("configure")

  const width = customWidth || selectedSize?.width || 0
  const height = customHeight || selectedSize?.height || 0
  const quantity = customQuantity || selectedQuantity || 0

  const area_m2 = (width / 1000) * (height / 1000)
  const basePrice = area_m2 * RATE_PER_M2
  const subtotal = basePrice * quantity
  const discountRate = getDiscountRate(quantity)
  const discountAmount = subtotal * discountRate
  const total = subtotal - discountAmount

  const nextTier = discountTiers.find((t) => quantity < t.min)
  const upsellMsg = nextTier
    ? `Add ${nextTier.min - quantity} more to save ${nextTier.discount * 100}%!`
    : `You saved ${discountRate * 100}% ($${discountAmount.toFixed(2)})`

  let shippingCost = 0
  let shippingMessage = ""

  if (total > 0) {
    if (total < 60) {
      shippingCost = Number.parseFloat(shippingMethod)
      shippingMessage = "Choose between Express or Standard Shipping."
    } else if (total >= 60 && total < 100) {
      shippingCost = 0
      shippingMessage = "You have received free Standard Shipping."
    } else if (total >= 100) {
      shippingCost = 0
      shippingMessage = "You have received free Express Shipping."
    }
  }

  const finalTotal = total + shippingCost

  useEffect(() => {
    const savedImages = localStorage.getItem("sticker-artwork-images")
    if (savedImages) {
      setUploadedImages(JSON.parse(savedImages))
    }
  }, [])

  useEffect(() => {
    if (uploadedImages.length > 0) {
      localStorage.setItem("sticker-artwork-images", JSON.stringify(uploadedImages))
    } else {
      localStorage.removeItem("sticker-artwork-images")
    }
  }, [uploadedImages])

  useEffect(() => {
    if (total >= 100) {
      setShippingMethod("0") // Free Express
    } else if (total >= 60) {
      setShippingMethod("0") // Free Standard
    } else {
      // Keep current selection or default to Express
      if (shippingMethod === "0") {
        setShippingMethod("13.95")
      }
    }
  }, [total])

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    const newImageUrls: string[] = []

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split(".").pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

        const { data, error } = await supabase.storage.from("artwork-files").upload(fileName, file)

        if (error) {
          console.error("Upload error:", error)
          alert(`Failed to upload ${file.name}. Please try again.`)
          continue
        }

        const {
          data: { publicUrl },
        } = supabase.storage.from("artwork-files").getPublicUrl(fileName)

        newImageUrls.push(publicUrl)
      }

      if (newImageUrls.length > 0) {
        setUploadedImages((prev) => [...prev, ...newImageUrls])
      }
    } catch (error) {
      console.error("Error uploading images:", error)
      alert("Upload failed. Please check your connection and try again.")
    } finally {
      setIsUploading(false)
      event.target.value = ""
    }
  }

  const removeImage = (imageUrl: string) => {
    setUploadedImages((prev) => prev.filter((url) => url !== imageUrl))
  }

  const handleContinue = () => {
    if (currentStep === "configure") {
      setCurrentStep("details")
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    setCurrentStep("configure")
  }

  const handleSubmit = () => {
    console.log("Form submitted - Ready to order!")
  }

  const isFormReady = (selectedSize || (customWidth && customHeight)) && (selectedQuantity || customQuantity)

  return (
    <main className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <form className="space-y-6">
          {currentStep === "configure" && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="size" className="text-gray-700 font-medium text-sm">
                    Size
                  </label>
                  <button type="button" className="text-blue-500 text-sm hover:underline">
                    Size help
                  </button>
                </div>
                <select
                  id="size"
                  value={showCustomSize ? "custom" : selectedSize?.label || ""}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setShowCustomSize(true)
                      setSelectedSize(null)
                    } else {
                      setShowCustomSize(false)
                      const size = sizes.find((s) => s.label === e.target.value)
                      setSelectedSize(size || null)
                      setCustomWidth(null)
                      setCustomHeight(null)
                    }
                  }}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select</option>
                  {sizes.map((s) => (
                    <option key={s.label} value={s.label}>
                      {s.label}
                    </option>
                  ))}
                  <option value="custom">Custom size</option>
                </select>

                {showCustomSize && (
                  <div className="flex gap-2 mt-2">
                    <input
                      type="number"
                      placeholder="Width (mm)"
                      className="border border-gray-300 rounded-md p-2 w-1/2"
                      value={customWidth ?? ""}
                      onChange={(e) => setCustomWidth(Number(e.target.value) || null)}
                    />
                    <input
                      type="number"
                      placeholder="Height (mm)"
                      className="border border-gray-300 rounded-md p-2 w-1/2"
                      value={customHeight ?? ""}
                      onChange={(e) => setCustomHeight(Number(e.target.value) || null)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="quantity" className="text-gray-700 font-medium text-sm">
                  Quantity
                </label>
                <select
                  id="quantity"
                  value={showCustomQuantity ? "custom" : selectedQuantity || ""}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setShowCustomQuantity(true)
                      setSelectedQuantity(null)
                    } else {
                      setShowCustomQuantity(false)
                      setSelectedQuantity(Number(e.target.value) || null)
                      setCustomQuantity(null)
                    }
                  }}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: "right 0.5rem center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "1.5em 1.5em",
                  }}
                >
                  <option value="">Select</option>
                  {[10, 25, 50, 100, 250, 500, 1000].map((q) => (
                    <option key={q} value={q}>
                      {q}
                    </option>
                  ))}
                  <option value="custom">Custom quantity</option>
                </select>

                {showCustomQuantity && (
                  <input
                    type="number"
                    min={1}
                    placeholder="Enter quantity"
                    className="border border-gray-300 rounded-md p-2 w-full mt-2"
                    value={customQuantity ?? ""}
                    onChange={(e) => setCustomQuantity(Number(e.target.value) || null)}
                  />
                )}

                {quantity > 0 && <div className="text-green-600 text-sm font-medium">{upsellMsg}</div>}
              </div>
            </>
          )}

          {currentStep === "details" && (
            <>
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                ← Back
              </button>

              <div>
                <label htmlFor="finish" className="text-gray-700 font-medium text-sm block mb-2">
                  Finish
                </label>
                <select
                  id="finish"
                  value={selectedFinish}
                  onChange={(e) => setSelectedFinish(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                >
                  <option value="">-- Select --</option>
                  <option value="standard">Standard</option>
                  <option value="matte">Matte</option>
                  <option value="gloss">Gloss</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="reorder"
                  checked={isReorder}
                  onChange={(e) => setIsReorder(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="reorder" className="text-gray-700 font-medium text-sm">
                  Is this a reorder?
                </label>
              </div>

              {isReorder && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="invoice-number" className="text-gray-700 font-medium text-sm block mb-2">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      id="invoice-number"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Enter your invoice number"
                      className="w-full p-3 border border-gray-300 rounded-md text-gray-900"
                    />
                  </div>

                  {invoiceNumber.trim() && (
                    <button
                      type="button"
                      className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors text-sm font-medium"
                    >
                      Skip proof
                    </button>
                  )}
                </div>
              )}

              <div>
                <label className="text-gray-700 font-medium text-sm block mb-3">
                  How will your print ready artwork be supplied?
                </label>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-sm ${
                      artworkMethod === "ready" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("ready")}
                  >
                    I have print-ready files
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-sm ${
                      artworkMethod === "design" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("design")}
                  >
                    Design my own online
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-sm ${
                      artworkMethod === "help" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => setArtworkMethod("help")}
                  >
                    I need design assistance
                  </button>
                </div>
              </div>

              {artworkMethod === "ready" && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                    <label htmlFor="upload-artwork" className="block cursor-pointer text-gray-700 font-medium text-sm">
                      {isUploading ? "Uploading..." : "Click to upload artwork"}
                    </label>
                    <input
                      type="file"
                      id="upload-artwork"
                      name="upload-artwork"
                      className="hidden"
                      multiple
                      accept=".ai,.eps,.pdf,.png,.jpg,.jpeg"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    <div className="mt-2 text-xs text-gray-500">
                      Accepted file types: ai, eps, pdf, png, jpg. Max: 250MB
                    </div>
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {uploadedImages.map((imageUrl, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square border border-gray-300 rounded-lg overflow-hidden bg-gray-50">
                            <img
                              src={imageUrl || "/placeholder.svg"}
                              alt={`Uploaded artwork ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage(imageUrl)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-colors"
                            title="Remove image"
                          >
                            ❌
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="shipping-method" className="text-gray-700 font-medium text-sm block mb-2">
                  Shipping Method
                </label>
                <select
                  id="shipping-method"
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md text-gray-900 bg-white"
                  disabled={total >= 60}
                >
                  {total >= 100 ? (
                    <option value="0">Express Shipping - FREE</option>
                  ) : total >= 60 ? (
                    <option value="0">Standard Shipping - FREE</option>
                  ) : (
                    <>
                      <option value="8.95">Standard Shipping - $8.95</option>
                      <option value="13.95">Express Shipping - $13.95</option>
                    </>
                  )}
                </select>
                {shippingMessage && <div className="text-green-600 text-sm mt-2 font-medium">{shippingMessage}</div>}
              </div>
            </>
          )}

          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-4xl font-bold text-gray-900">${finalTotal.toFixed(2)}</div>
              <div className="text-gray-600 text-sm">
                ${quantity > 0 ? (finalTotal / quantity).toFixed(2) : "0.00"} / sticker
              </div>
            </div>

            <button
              type="button"
              onClick={handleContinue}
              className={`w-full font-semibold py-3 px-4 rounded-md transition-colors ${
                isFormReady ? "bg-black text-white hover:bg-gray-800" : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!isFormReady}
            >
              {currentStep === "configure" ? "Continue" : "Ready to order?"}
            </button>

            {currentStep === "configure" && (
              <div className="text-center text-gray-500 text-sm mt-2">Next: upload artwork →</div>
            )}
          </div>
        </form>
      </div>
    </main>
  )
}
