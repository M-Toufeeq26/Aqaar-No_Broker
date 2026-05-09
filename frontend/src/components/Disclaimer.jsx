import React from 'react'

const Disclaimer = ({ variant = 'footer' }) => {
  const disclaimerText = "This is a no-broker, direct owner platform. Buyers are advised to do their own research, verify all documents, and conduct due diligence before making any purchase. Aqaar is not responsible for any disputes, losses, or fraudulent transactions."

  if (variant === 'footer') {
    return (
      <div className="bg-gray-900 border-t border-gray-800 py-6 px-4 mt-8">
        <div className="container mx-auto max-w-6xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-400 leading-relaxed">
                <span className="font-semibold text-gray-300">Disclaimer:</span> {disclaimerText}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Property detail page variant
  return (
    <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-xl p-4 my-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs text-yellow-300 leading-relaxed">
            <span className="font-semibold">⚠️ Important:</span> {disclaimerText}
          </p>
        </div>
      </div>
    </div>
  )
}

export default Disclaimer