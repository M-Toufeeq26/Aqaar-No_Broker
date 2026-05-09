import { useState, useEffect } from 'react'
import api from '../services/api'

const LocationSelect = ({ onCityChange, initialCity = '' }) => {
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [selectedStateId, setSelectedStateId] = useState('')
  const [selectedCity, setSelectedCity] = useState(initialCity)

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await api.get('/locations/states')
        setStates(res.data)
      } catch (err) {
        console.error('Failed to fetch states', err)
      }
    }
    fetchStates()
  }, [])

  useEffect(() => {
    if (selectedStateId) {
      const fetchCities = async () => {
        try {
          const res = await api.get(`/locations/cities/${selectedStateId}`)
          setCities(res.data)
        } catch (err) {
          console.error('Failed to fetch cities', err)
          setCities([])
        }
      }
      fetchCities()
    } else {
      setCities([])
    }
  }, [selectedStateId])

  const handleStateChange = (e) => {
    const stateId = e.target.value
    setSelectedStateId(stateId)
    setSelectedCity('')
    onCityChange('')
  }

  const handleCityChange = (e) => {
    const cityName = e.target.value
    setSelectedCity(cityName)
    onCityChange(cityName)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <select
        value={selectedStateId}
        onChange={handleStateChange}
        className="input"
      >
        <option value="">Select State</option>
        {states.map((state) => (
          <option key={state.id} value={state.id}>
            {state.name}
          </option>
        ))}
      </select>

      <select
        value={selectedCity}
        onChange={handleCityChange}
        disabled={!selectedStateId}
        className="input"
      >
        <option value="">Select City</option>
        {cities.map((city) => (
          <option key={city.id} value={city.name}>
            {city.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default LocationSelect