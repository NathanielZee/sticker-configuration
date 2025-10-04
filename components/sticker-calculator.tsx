"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const SMule = (() => {
  const LIMITS = { minW: 20, maxW: 1400, minH: 20, maxH: 1400, minQ: 20, maxQ: 200000 }

  const FACTOR = {
    50: 1.0,
    100: 0.75,
    200: 0.6,
    300: 0.52,
    500: 0.4,
    1000: 0.3,
    2000: 0.24,
    3000: 0.21,
    5000: 0.17,
    10000: 0.145,
    20000: 0.1,
  }
  const TIER_MODE = "LOWER"

  const ANCHORS = [
    { w: 20, h: 20, qty: 10, total: 20, factorOverride: 1.0 },
    { w: 20, h: 20, qty: 200000, total: 5644, factorOverride: 0.01411 },
    { w: 50, h: 50, qty: 50, total: 82 },
    { w: 75, h: 75, qty: 50, total: 98 },
    { w: 100, h: 100, qty: 50, total: 118 },
    { w: 125, h: 125, qty: 50, total: 141 },
    { w: 140, h: 180, qty: 250, total: 502, factorOverride: 0.64 },
    { w: 150, h: 150, qty: 160, total: 341, factorOverride: 0.75 },
    { w: 185, h: 95, qty: 650, total: 788, factorOverride: 0.4 },
    { w: 430, h: 360, qty: 850, total: 5473, factorOverride: 0.4 },
    { w: 450, h: 450, qty: 6400, total: 53101, factorOverride: 0.6 },
    { w: 500, h: 350, qty: 240, total: 2081, factorOverride: 0.7 },
    { w: 800, h: 609, qty: 20000, total: 397780, factorOverride: 0.74 },
    { w: 914, h: 609, qty: 10, total: 401, factorOverride: 1.0 },
    { w: 914, h: 609, qty: 200000, total: 4541112, factorOverride: 0.76 },
  ]

  const SIZE_FACTOR_OVERRIDES: Record<string, Record<number, number>> = {
    "50×50": { 100: 0.6 },
    "75×75": { 100: 0.65 },
    "100×100": { 100: 0.69 },
    "125×125": { 100: 0.72 },
    "140×180": { 250: 0.64 },
    "150×150": { 160: 0.75 },
    "185×95": { 650: 0.4 },
    "430×360": { 850: 0.4 },
    "450×450": { 6400: 0.6 },
    "500×350": { 240: 0.7 },
    "800×609": { 20000: 0.74 },
    "914×609": { 10: 1.0, 200000: 0.76 },
    "20×20": { 10: 1.0, 200000: 0.01411 },
  }

  const PM2_CLAMP = { min: 50, max: 5000 }

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const areaM2 = (w: number, h: number) => (w / 1000) * (h / 1000)

  function tierFactor(q: number, factors: Record<number, number>, mode: string = TIER_MODE) {
    const t = Object.keys(factors)
      .map(Number)
      .sort((a, b) => a - b)
    if (q <= t[0]) return factors[t[0]]
    if (q >= t[t.length - 1]) return factors[t[t.length - 1]]
    for (let i = 0; i < t.length - 1; i++) {
      const lo = t[i],
        hi = t[i + 1]
      if (q === hi) return factors[hi]
      if (q > lo && q < hi) return mode === "LOWER" ? factors[lo] : factors[hi]
    }
    return factors[t[t.length - 1]]
  }

  function buildPm2Data(anchors: typeof ANCHORS) {
    const pts: Array<{ area: number; Pm2: number }> = []
    const exactSizePm2 = new Map<string, number>()

    for (const a of anchors) {
      const A = areaM2(a.w, a.h)
      const key = `${a.w}×${a.h}`
      const perSize = SIZE_FACTOR_OVERRIDES[key] || {}
      const ladderF = tierFactor(a.qty, FACTOR, TIER_MODE)
      const f = typeof a.factorOverride === "number" ? a.factorOverride : (perSize[a.qty] ?? ladderF)

      const base50 = a.total / (f * (a.qty / 50))
      const Pm2 = base50 / (A * 50)

      if (isFinite(Pm2) && Pm2 > 0) {
        pts.push({ area: A, Pm2 })
        exactSizePm2.set(key, exactSizePm2.has(key) ? (exactSizePm2.get(key)! + Pm2) / 2 : Pm2)
      }
    }
    return { pts, exactSizePm2 }
  }

  function fitPower(points: Array<{ area: number; Pm2: number }>, clampBounds = PM2_CLAMP) {
    if (!points.length) return () => 300
    if (points.length === 1) {
      const P = points[0].Pm2
      return () => clamp(P, clampBounds.min, clampBounds.max)
    }

    const xs = points.map((p) => Math.log(p.area))
    const ys = points.map((p) => Math.log(p.Pm2))
    const n = xs.length
    const sum = (a: number[]) => a.reduce((s, v) => s + v, 0)
    const xbar = sum(xs) / n,
      ybar = sum(ys) / n

    let num = 0,
      den = 0
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xbar) * (ys[i] - ybar)
      den += (xs[i] - xbar) ** 2
    }

    const b = den === 0 ? 0 : num / den
    const a = ybar - b * xbar

    return (A: number) => clamp(Math.exp(a + b * Math.log(A)), clampBounds.min, clampBounds.max)
  }

  const { pts, exactSizePm2 } = buildPm2Data(ANCHORS)
  const Pm2Fit = fitPower(pts, PM2_CLAMP)

  function price({ widthMM, heightMM, qty }: { widthMM: number; heightMM: number; qty: number }) {
    const w = clamp(Math.round(widthMM), LIMITS.minW, LIMITS.maxW)
    const h = clamp(Math.round(heightMM), LIMITS.minH, LIMITS.maxH)
    const q = clamp(Math.round(qty), LIMITS.minQ, LIMITS.maxQ)
    const A = areaM2(w, h)

    const key = `${w}×${h}`
    const Pm2 = exactSizePm2.has(key) ? exactSizePm2.get(key)! : Pm2Fit(A)

    const perSize = SIZE_FACTOR_OVERRIDES[key] || {}
    const ladderF = tierFactor(q, FACTOR, TIER_MODE)
    const f = perSize[q] ?? ladderF

    const base50 = Pm2 * A * 50
    const total = base50 * f * (q / 50)

    const tiers = Object.keys(FACTOR)
      .map(Number)
      .sort((a, b) => a - b)
    const nextTierQty = tiers.find((t) => t > q)
    let nextTier = null

    if (nextTierQty) {
      const nextF = perSize[nextTierQty] ?? tierFactor(nextTierQty, FACTOR, TIER_MODE)
      const savePct = Math.round((1 - f) * 100)
      const nextSavePct = Math.round((1 - nextF) * 100)

      nextTier = {
        nextQty: nextTierQty,
        addMore: nextTierQty - q,
        nextSavePct,
      }
    }

    return {
      total: Number(total.toFixed(2)),
      each: Number((total / q).toFixed(2)),
      base50: Number(base50.toFixed(2)),
      pricePerM2: Number(Pm2.toFixed(2)),
      factorUsed: f,
      savePct: Math.round((1 - f) * 100),
      nextTier,
    }
  }

  return { price }
})()

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
      pricingResult = SMule.price({
        widthMM: width,
        heightMM: height,
        qty: quantity,
      })

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
                        const result = SMule.price({ widthMM: width, heightMM: height, qty })
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


