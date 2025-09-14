"use client"

import type React from "react"
import { useState, useEffect } from "react"

export default function StickerCalculator() {
  const [selectedSize, setSelectedSize] = useState("")
  const [customLength, setCustomLength] = useState("")
  const [customWidth, setCustomWidth] = useState("")
  const [selectedQuantity, setSelectedQuantity] = useState("")
  const [customQuantity, setCustomQuantity] = useState("")
  const [selectedFinish, setSelectedFinish] = useState("")
  const [isReorder, setIsReorder] = useState(false)
  const [artworkMethod, setArtworkMethod] = useState("")
  const [shippingMethod, setShippingMethod] = useState("13.95")
  const [totalPrice, setTotalPrice] = useState(0)
  const [pricePerSticker, setPricePerSticker] = useState(0)
  const [lengthError, setLengthError] = useState(false)
  const [widthError, setWidthError] = useState(false)
  const [quantityError, setQuantityError] = useState(false)
  const [showArtworkSection, setShowArtworkSection] = useState(false)

  const calculatePrice = () => {
    let size = 0
    let quantity = 0

    // Get size
    if (selectedSize === "custom") {
      if (customLength && customWidth) {
        size = Number.parseInt(customLength) * Number.parseInt(customWidth)
      }
    } else if (selectedSize) {
      size = Number.parseInt(selectedSize) * Number.parseInt(selectedSize)
    }

    // Get quantity
    if (selectedQuantity === "custom") {
      quantity = Number.parseInt(customQuantity) || 0
    } else if (selectedQuantity) {
      quantity = Number.parseInt(selectedQuantity)
    }

    if (size > 0 && quantity > 0 && selectedFinish) {
      // Basic pricing calculation (simplified)
      const basePrice = (size / 1000) * 0.5 // Base price per mm²
      const total = basePrice * quantity * 1.1 // Add 10% GST
      const shipping = Number.parseFloat(shippingMethod)
      const finalTotal = total + shipping

      setTotalPrice(finalTotal)
      setPricePerSticker(finalTotal / quantity)
      setShowArtworkSection(true)
    } else {
      setTotalPrice(0)
      setPricePerSticker(0)
      setShowArtworkSection(false)
    }
  }

  useEffect(() => {
    calculatePrice()
  }, [selectedSize, customLength, customWidth, selectedQuantity, customQuantity, selectedFinish, shippingMethod])

  const handleSizeChange = (value: string) => {
    setSelectedSize(value)
    if (value !== "custom") {
      setCustomLength("")
      setCustomWidth("")
      setLengthError(false)
      setWidthError(false)
    }
  }

  const handleQuantityChange = (value: string) => {
    setSelectedQuantity(value)
    if (value !== "custom") {
      setCustomQuantity("")
      setQuantityError(false)
    }
  }

  const handleArtworkMethodChange = (method: string) => {
    setArtworkMethod(method)
  }

  const validateCustomLength = (value: string) => {
    const num = Number.parseInt(value)
    const isValid = !isNaN(num) && num >= 20 && num <= 1000
    setLengthError(!isValid && value !== "")
    return isValid
  }

  const validateCustomWidth = (value: string) => {
    const num = Number.parseInt(value)
    const isValid = !isNaN(num) && num >= 20 && num <= 1000
    setWidthError(!isValid && value !== "")
    return isValid
  }

  const validateCustomQuantity = (value: string) => {
    const num = Number.parseInt(value)
    const isValid = !isNaN(num) && num >= 10 && num <= 200000
    setQuantityError(!isValid && value !== "")
    return isValid
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted")
  }

  return (
    <main className="min-h-screen bg-white p-3 md:p-5 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white border border-gray-300 rounded-lg p-4 md:p-8 shadow-sm">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-5">
          <section className="space-y-3 md:space-y-5">
            <div className="flex flex-col">
              <label htmlFor="size" className="font-semibold text-black mb-1 text-sm md:text-base">
                Size
              </label>
              <select
                id="size"
                value={selectedSize}
                onChange={(e) => handleSizeChange(e.target.value)}
                className="p-2 md:p-3 border border-gray-300 rounded text-black bg-white text-sm md:text-base"
              >
                <option value="">-- Select --</option>
                <option value="50">50mm x 50mm</option>
                <option value="75">75mm x 75mm</option>
                <option value="100">100mm x 100mm</option>
                <option value="125">125mm x 125mm</option>
                <option value="custom">Custom Size</option>
              </select>
            </div>

            {selectedSize === "custom" && (
              <div className="space-y-4">
                <div className="flex flex-col">
                  <label htmlFor="custom-length" className="font-semibold text-black mb-1 text-sm md:text-base">
                    Custom Length (mm)
                  </label>
                  <input
                    type="number"
                    id="custom-length"
                    placeholder="Min 20mm, Max 1000mm"
                    value={customLength}
                    onChange={(e) => {
                      setCustomLength(e.target.value)
                      validateCustomLength(e.target.value)
                    }}
                    className="p-3 border border-gray-300 rounded text-black bg-white text-base"
                  />
                  {lengthError && (
                    <div className="text-red-500 text-sm mt-1">Please enter a value between 20 and 1000</div>
                  )}
                </div>

                <div className="flex flex-col">
                  <label htmlFor="custom-width" className="font-semibold text-black mb-1 text-sm md:text-base">
                    Custom Width (mm)
                  </label>
                  <input
                    type="number"
                    id="custom-width"
                    placeholder="Min 20mm, Max 1000mm"
                    value={customWidth}
                    onChange={(e) => {
                      setCustomWidth(e.target.value)
                      validateCustomWidth(e.target.value)
                    }}
                    className="p-3 border border-gray-300 rounded text-black bg-white text-base"
                  />
                  {widthError && (
                    <div className="text-red-500 text-sm mt-1">Please enter a value between 20 and 1000</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col">
              <label htmlFor="quantity" className="font-semibold text-black mb-1 text-sm md:text-base">
                Quantity
              </label>
              <select
                id="quantity"
                value={selectedQuantity}
                onChange={(e) => handleQuantityChange(e.target.value)}
                className="p-2 md:p-3 border border-gray-300 rounded text-black bg-white text-sm md:text-base"
              >
                <option value="">-- Select --</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="300">300</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="2000">2000</option>
                <option value="3000">3000</option>
                <option value="5000">5000</option>
                <option value="10000">10000</option>
                <option value="15000">15000</option>
                <option value="20000">20000</option>
                <option value="custom">Custom Qty</option>
              </select>
            </div>

            {selectedQuantity === "custom" && (
              <div className="flex flex-col">
                <label htmlFor="custom-quantity" className="font-semibold text-black mb-1 text-sm md:text-base">
                  Custom Quantity
                </label>
                <input
                  type="number"
                  id="custom-quantity"
                  placeholder="Enter quantity between 10 and 200000"
                  value={customQuantity}
                  onChange={(e) => {
                    setCustomQuantity(e.target.value)
                    validateCustomQuantity(e.target.value)
                  }}
                  className="p-2 md:p-3 border border-gray-300 rounded text-black bg-white text-sm md:text-base"
                />
                {quantityError && (
                  <div className="text-red-500 text-xs md:text-sm mt-1">
                    Please enter a quantity between 10 and 200000
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col">
              <label htmlFor="finish" className="font-semibold text-black mb-1 text-sm md:text-base">
                Finish
              </label>
              <select
                id="finish"
                value={selectedFinish}
                onChange={(e) => setSelectedFinish(e.target.value)}
                className="p-2 md:p-3 border border-gray-300 rounded text-black bg-white text-sm md:text-base"
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
                className="w-3 h-3 md:w-4 md:h-4"
              />
              <label htmlFor="reorder" className="font-semibold text-black text-sm md:text-base">
                Is this a reorder?
              </label>
            </div>
          </section>

          {totalPrice > 0 && (
            <section className="space-y-2 md:space-y-3">
              <div className="text-xl md:text-3xl font-bold text-green-600 flex items-center gap-2">
                ${totalPrice.toFixed(2)}
                <span className="text-xs text-black font-normal">includes GST</span>
              </div>
              <div className="text-xs md:text-sm text-gray-600">= ${pricePerSticker.toFixed(2)} per sticker</div>

              <div className="flex flex-col">
                <label htmlFor="shipping-method" className="font-semibold text-black mb-1 text-sm md:text-base">
                  Shipping Method
                </label>
                <select
                  id="shipping-method"
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value)}
                  className="p-2 md:p-3 border border-gray-300 rounded text-black bg-white text-sm md:text-base"
                >
                  <option value="13.95">Express $13.95</option>
                  <option value="8.95">Standard $8.95</option>
                </select>
              </div>
            </section>
          )}

          {showArtworkSection && (
            <section className="space-y-3 md:space-y-4">
              <div className="flex flex-col">
                <label className="font-semibold text-black mb-2 md:mb-3 text-sm md:text-base">
                  How will your print ready artwork be supplied?
                </label>
                <div className="flex flex-col gap-2 md:flex-row">
                  <button
                    type="button"
                    className={`px-2 py-1.5 border border-gray-300 rounded font-bold cursor-pointer text-xs md:text-sm md:flex-1 ${
                      artworkMethod === "ready" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => handleArtworkMethodChange("ready")}
                  >
                    I have print-ready files
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1.5 border border-gray-300 rounded font-bold cursor-pointer text-xs md:text-sm md:flex-1 ${
                      artworkMethod === "design" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => handleArtworkMethodChange("design")}
                  >
                    Design my own online
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1.5 border border-gray-300 rounded font-bold cursor-pointer text-xs md:text-sm md:flex-1 ${
                      artworkMethod === "help" ? "bg-black text-white" : "bg-gray-100 text-black"
                    }`}
                    onClick={() => handleArtworkMethodChange("help")}
                  >
                    I need design assistance
                  </button>
                </div>
              </div>

              {artworkMethod === "ready" && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 md:p-5 text-center bg-gray-50">
                  <label
                    htmlFor="upload-artwork"
                    className="block cursor-pointer text-black font-semibold text-sm md:text-base"
                  >
                    Click to upload artwork
                  </label>
                  <input type="file" id="upload-artwork" name="upload-artwork" className="hidden" />
                  <div className="mt-2 text-xs md:text-sm text-gray-500">
                    Accepted file types: ai, eps, pdf, png, jpg. Max: 250MB
                  </div>
                </div>
              )}
            </section>
          )}

          <button
            type="submit"
            className="mt-3 md:mt-5 p-2 md:p-3 text-sm md:text-base bg-black text-white border-none rounded cursor-pointer font-semibold"
          >
            Ready to order?
          </button>
        </form>
      </div>
    </main>
  )
}
