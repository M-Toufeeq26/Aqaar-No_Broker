import { useEffect, useState } from 'react'
import api from '../services/api'

const RazorpayPayment = ({ 
  amount,           
  paymentType,      
  propertyId, 
  durationDays,
  onSuccess,
  onError,
  trigger           
}) => {
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (trigger) {
      initiatePayment()
    }
  }, [trigger])

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })
  }

  const initiatePayment = async () => {
    setLoading(true)
    
    try {
      const isScriptLoaded = await loadRazorpayScript()
      if (!isScriptLoaded) {
        alert('Failed to load Razorpay. Please check your internet connection.')
        setLoading(false)
        return
      }

      const orderResponse = await api.post('/payments/create-order', {
        payment_type: paymentType,
        amount: amount,
        property_id: parseInt(propertyId),
        duration_days: durationDays
      })

      const { order_id, amount: orderAmount, currency } = orderResponse.data

      const options = {
        key: 'rzp_test_ShSRMSRNfnH1Ai',
        amount: orderAmount,
        currency: currency,
        name: 'Aqaar Real Estate',
        description: paymentType === 'property_verification' 
          ? `Property Verification for ${durationDays} days` 
          : `Property Sponsorship for ${durationDays} days`,
        order_id: order_id,
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: 'var(--color-primary)'
        },
        modal: {
          ondismiss: () => {
            console.log('Payment modal closed')
            setLoading(false)
            if (onError) onError('Payment cancelled')
          }
        },
        handler: async (response) => {
          try {
            const verifyResponse = await api.post('/payments/verify', {
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature
            })

            if (verifyResponse.data.status === 'success') {
              const message = paymentType === 'property_verification'
                ? 'Verification request submitted! Admin will review within 2-3 days.'
                : 'Sponsorship request submitted! Admin will review within 2-3 days.'
              alert(message)
              if (onSuccess) onSuccess(verifyResponse.data)
            } else {
              alert('Payment verification failed. Please contact support.')
              if (onError) onError('Verification failed')
            }
          } catch (err) {
            console.error('Verification error:', err)
            alert(err.response?.data?.detail || 'Payment verification failed. Please try again.')
            if (onError) onError(err)
          } finally {
            setLoading(false)
          }
        }
      }

      const razorpay = new window.Razorpay(options)
      razorpay.open()

    } catch (err) {
      console.error('Payment initiation error:', err)
      const errorMsg = err.response?.data?.detail || 'Failed to initiate payment. Please try again.'
      alert(errorMsg)
      if (onError) onError(err)
      setLoading(false)
    }
  }

  return null
}

export default RazorpayPayment