"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

// Sticker Mule Direct Pricing - Copied from their AU site
const DISCOUNT_LADDER: Record<number, number> = {
  50: 0.0,
  100: 0.4,
  200: 0.61,
  300: 0.68,
  500: 0.75,
  1000: 0.81,
  2000: 0.85,
  3000: 0.86,
  5000: 0.88,
  10000: 0.9,
}

const BASE_50_TOTAL_BY_SIZE: Record<string, number> = {
  "50x50": 82.0,
  "75x75": 101.0,
  "100x100": 125.12,
  "125x125": 157.45,
}

// Custom size pricing formula
const K = 0.005748880748880748
const B = 67.62779812779813

function getBase50Total(width: number, height: number, presetKey?: string): number {
  if (presetKey && BASE_50_TOTAL_BY_SIZE[presetKey]) {
    return BASE_50_TOTAL_BY_SIZE[presetKey]
  }
  const area = width * height
  return Math.max(B + K * area, 20)
}

function ladderDiscountFor(qty: number): number {
  const tiers = Object.keys(DISCOUNT_LADDER)
    .map(Number)
    .sort((a, b) => a - b)

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (qty >= tiers[i]) {
      return DISCOUNT_LADDER[tiers[i]]
    }
  }
  return 0
}

function unitPriceAtQty(base50Total: number, qty: number): number {
  const baseUnit = base50Total / 50
  const discount = ladderDiscountFor(qty)
  return baseUnit * (1 - discount)
}

function calculatePrice(width: number, height: number, qty: number) {
  const sizeKey = `${width}x${height}`
  const base50 = getBase50Total(width, height, sizeKey)
  const unitPrice = unitPriceAtQty(base50, qty)
  const total = unitPrice * qty
  const savePct = Math.round(ladderDiscountFor(qty) * 100)

  // Find next tier
  const tiers = Object.keys(DISCOUNT_LADDER)
    .map(Number)
    .sort((a, b) => a - b)
  const nextTierQty = tiers.find((t) => t > qty)
  let nextTier = null

  if (nextTierQty) {
    const nextSavePct = Math.round(ladderDiscountFor(nextTierQty) * 100)
    nextTier = {
      nextQty: nextTierQty,
      addMore: nextTierQty - qty,
      nextSavePct,
    }
  }

  return {
    total: Number(total.toFixed(2)),
    each: Number(unitPrice.toFixed(2)),
    savePct,
    nextTier,
  }
}

const qtyTiers = [50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 20000]

const sizes = [
  { label: "50 × 50 mm", width: 50, height: 50 },
  { label: "75 × 75 mm", width: 75, height: 75 },
  { label: "100 × 100 mm", width: 100, height: 100 },
  { label: "125 × 125 mm", width: 125, height: 125 },
]

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

  const width = customWidth || selectedSize?.width || 0
  const height = customHeight || selectedSize?.height || 0
  const quantity = customQuantity || selectedQuantity || 0

  let pricingResult = null
  let total = 0
  let unitPrice = 0
  let upsellMsg = ""

  if (width > 0 && height > 0 && quantity > 0) {
    try {
      pricingResult = calculatePrice(width, height, quantity)

      total = pricingResult.total
      unitPrice = pricingResult.each

      if (pricingResult.nextTier) {
        upsellMsg = `Save ${pricingResult.nextTier.nextSavePct}% when you add ${pricingResult.nextTier.addMore} stickers`
      } else if (pricingResult.savePct > 0) {
        upsellMsg = `You saved ${pricingResult.savePct}%`
      }
    } catch (error) {
      console.error("Pricing error:", error)
    }
  }

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
      setShippingMethod("0")
    } else if (total >= 60) {
      setShippingMethod("0")
    } else {
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

  const handleSubmit = () => {
    console.log("Form submitted - Ready to order!")
  }

  const isFormReady = (selectedSize || (customWidth && customHeight)) && (selectedQuantity || customQuantity)

  return (
    <main className="min-h-screen bg-gray-50 p-2 sm:p-4 flex items-center justify-center">
      <div className="w-full max-w-xs sm:max-w-md lg:max-w-xl xl:max-w-2xl bg-white rounded-lg p-3 sm:p-6 lg:p-8 shadow-sm border border-gray-200">
        <form className="space-y-3 sm:space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label htmlFor="size" className="text-gray-700 font-medium text-xs sm:text-sm">
                Size
              </label>
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
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none text-sm sm:text-base"
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
                  className="border border-gray-300 rounded-md p-2 w-1/2 text-sm sm:text-base"
                  value={customWidth ?? ""}
                  onChange={(e) => setCustomWidth(Number(e.target.value) || null)}
                />
                <input
                  type="number"
                  placeholder="Height (mm)"
                  className="border border-gray-300 rounded-md p-2 w-1/2 text-sm sm:text-base"
                  value={customHeight ?? ""}
                  onChange={(e) => setCustomHeight(Number(e.target.value) || null)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="quantity" className="text-gray-700 font-medium text-xs sm:text-sm">
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
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white appearance-none text-sm sm:text-base"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                backgroundPosition: "right 0.5rem center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "1.5em 1.5em",
              }}
            >
              <option value="">Select</option>
              {(() => {
                if (width > 0 && height > 0) {
                  return qtyTiers
                    .map((qty) => {
                      try {
                        const result = calculatePrice(width, height, qty)
                        return (
                          <option key={qty} value={qty}>
                            {qty} stickers • ${result.total}
                          </option>
                        )
                      } catch {
                        return null
                      }
                    })
                    .filter(Boolean)
                } else {
                  return qtyTiers.map((q) => (
                    <option key={q} value={q}>
                      {q} stickers
                    </option>
                  ))
                }
              })()}
              <option value="custom">Custom quantity</option>
            </select>

            {showCustomQuantity && (
              <input
                type="number"
                min={1}
                placeholder="Enter quantity"
                className="border border-gray-300 rounded-md p-2 w-full mt-2 text-sm sm:text-base"
                value={customQuantity ?? ""}
                onChange={(e) => setCustomQuantity(Number(e.target.value) || null)}
              />
            )}

            {quantity > 0 && upsellMsg && (
              <div className="text-green-600 text-xs sm:text-sm font-medium">{upsellMsg}</div>
            )}
          </div>

          <div>
            <label htmlFor="finish" className="text-gray-700 font-medium text-xs sm:text-sm block mb-2">
              Finish
            </label>
            <select
              id="finish"
              value={selectedFinish}
              onChange={(e) => setSelectedFinish(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white text-sm sm:text-base"
            >
              <option value="">-- Select --</option>
              <option value="standard">Standard - light scratch resistant great for promo!</option>
              <option value="matte">Super Ninja Glossy - 100% weather resistant / dishwasher safe!</option>
              <option value="gloss">Moshi Moshi Matte - recommended for indoor use</option>
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
            <label htmlFor="reorder" className="text-gray-700 font-medium text-xs sm:text-sm">
              Is this a reorder?
            </label>
          </div>

          {isReorder && (
            <div className="space-y-3">
              <div>
                <label htmlFor="invoice-number" className="text-gray-700 font-medium text-xs sm:text-sm block mb-2">
                  Invoice Number
                </label>
                <input
                  type="text"
                  id="invoice-number"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter your invoice number"
                  className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 text-sm sm:text-base"
                />
              </div>

              {invoiceNumber.trim() && (
                <button
                  type="button"
                  className="bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-600 transition-colors text-xs sm:text-sm font-medium"
                >
                  Skip proof
                </button>
              )}
            </div>
          )}

          <div>
            <label className="text-gray-700 font-medium text-xs sm:text-sm block mb-3">
              How will your print ready artwork be supplied?
            </label>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
                  artworkMethod === "ready" ? "bg-black text-white" : "bg-gray-100 text-black"
                }`}
                onClick={() => setArtworkMethod("ready")}
              >
                I have print-ready files
              </button>
              <button
                type="button"
                className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
                  artworkMethod === "design" ? "bg-black text-white" : "bg-gray-100 text-black"
                }`}
                onClick={() => setArtworkMethod("design")}
              >
                Design my own online
              </button>
              <button
                type="button"
                className={`px-3 py-2 border border-gray-300 rounded font-medium cursor-pointer text-xs sm:text-sm ${
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
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 sm:p-4 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
                <label
                  htmlFor="upload-artwork"
                  className="block cursor-pointer text-gray-700 font-medium text-xs sm:text-sm"
                >
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

          {artworkMethod === "design" && (
            <div className="p-4 border border-gray-300 rounded bg-gray-50">
              <p className="text-gray-700 text-sm">Redirecting to Sticker Ninja Designer...</p>
            </div>
          )}

          {artworkMethod === "help" && (
            <div className="p-4 border border-gray-300 rounded bg-gray-50">
              <p className="text-gray-700 text-sm">Feature coming soon...</p>
            </div>
          )}

          <div>
            <label htmlFor="shipping-method" className="text-gray-700 font-medium text-xs sm:text-sm block mb-2">
              Shipping Method
            </label>
            <select
              id="shipping-method"
              value={shippingMethod}
              onChange={(e) => setShippingMethod(e.target.value)}
              className="w-full p-2 sm:p-3 border border-gray-300 rounded-md text-gray-900 bg-white text-sm sm:text-base"
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
            {shippingMessage && (
              <div className="text-green-600 text-xs sm:text-sm mt-2 font-medium">{shippingMessage}</div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4 sm:pt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-2xl sm:text-4xl font-bold text-gray-900">${finalTotal.toFixed(2)}</div>
              <div className="text-gray-600 text-xs sm:text-sm">
                ${quantity > 0 ? (finalTotal / quantity).toFixed(2) : "0.00"} / sticker
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              className={`w-full font-semibold py-3 px-4 rounded-md transition-colors text-sm sm:text-base ${
                isFormReady ? "bg-black text-white hover:bg-gray-800" : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
              disabled={!isFormReady}
            >
              Ready to order?
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}


