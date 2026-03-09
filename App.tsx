import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  MapPin, 
  Maximize, 
  Bed, 
  Bath, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  Calculator,
  User,
  Mail,
  Phone,
  ArrowRight,
  Building2,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Clock,
  LayoutDashboard,
  X
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PropertyData, LeadData, PROPERTY_TYPES, CONDITIONS, FEATURES } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Technical Valuation Framework for Costa del Sol
const VALUATION_MANUAL_CONTENT = `
SISTEMA TÉCNICO DE VALORACIÓN PROFESIONAL (MÉTODO DE COMPARACIÓN):

1. PRECIO BASE DE ZONA (VMB):
   - Málaga Capital: 2.800€ - 3.500€/m²
   - Marbella (Milla de Oro): 6.000€ - 12.000€/m²
   - Estepona: 3.200€ - 4.500€/m²
   - Benalmádena/Fuengirola: 2.500€ - 3.800€/m²
   - Alhaurín de la Torre: 2.000€ - 2.800€/m²
   - Alhaurín el Grande/Coín/Cártama: 1.400€ - 2.200€/m²
   - Pizarra: 1.200€ - 1.700€/m²

2. COEFICIENTES DE CORRECCIÓN TÉCNICA (Ck):
   - Superficie (Cs): <50m² (+10%), 50-100m² (0%), 100-200m² (-5%), >200m² (-10%).
   - Estado (Ce): Obra nueva (1.20), Excelente (1.10), Buen estado (1.00), Reformado (1.05), A reformar (0.75).
   - Planta (Cp): Ático (1.15), Planta alta (1.05), Planta media (1.00), Bajo (0.90).
   - Vistas (Cv): Vistas frontales mar (1.25), Vistas laterales mar (1.10), Sin vistas (1.00).
   - Extras (Cx): Piscina (+5%), Garaje (+15.000€ - 30.000€ fijos), Terraza >20m² (+8%).

3. FÓRMULA DE CÁLCULO:
   Valor = (Superficie * Precio_Base_Zona) * Cs * Ce * Cp * Cv * Cx
`;

export default function App() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{summary: string, breakdown: string} | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [formData, setFormData] = useState<LeadData>({
    address: '',
    city: 'Málaga',
    propertyType: 'Piso',
    size: 80,
    rooms: 2,
    bathrooms: 1,
    halfBaths: 0,
    floor: undefined,
    houseFloors: undefined,
    constructionYear: undefined,
    condition: 'Buen estado',
    features: [],
    lastFullRenovationYear: undefined,
    lastPartialRenovationYear: undefined,
    accessibility: 'Ninguna',
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (showAdmin) {
      fetch('/api/leads')
        .then(res => res.json())
        .then(data => setLeads(data))
        .catch(err => console.error("Error fetching leads:", err));
    }
  }, [showAdmin]);

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const calculateValuation = async () => {
    setLoading(true);
    try {
      const prompt = `
        SISTEMA DE VALORACIÓN TÉCNICA PROFESIONAL (MÉTODO DE REPOSICIÓN Y COMPARACIÓN):
        
        INSTRUCCIÓN:
        Actúa como un experto tasador inmobiliario senior en la Costa del Sol. 
        Debes realizar una valoración basada en el valor de reposición del suelo y el método de comparación.
        
        DATOS DE LA PROPIEDAD:
        - Ubicación: ${formData.address}, ${formData.city}
        - Tipo: ${formData.propertyType}
        - Planta (si es piso/ático/dúplex): ${formData.floor || 'N/A'}
        - Plantas totales (si es casa/villa/chalet): ${formData.houseFloors || 'N/A'}
        - Superficie: ${formData.size} m²
        - Dormitorios: ${formData.rooms}
        - Baños completos: ${formData.bathrooms}
        - Aseos: ${formData.halfBaths}
        - Estado: ${formData.condition}
        - Año de construcción: ${formData.constructionYear || 'N/A'}
        - Año última reforma integral: ${formData.lastFullRenovationYear || 'N/A'}
        - Año última reforma parcial: ${formData.lastPartialRenovationYear || 'N/A'}
        - Accesibilidad minusválidos: ${formData.accessibility}
        - Extras: ${formData.features.join(', ')}

        CRITERIOS TÉCNICOS ADICIONALES:
        - Si es Ático, aplica un coeficiente de incremento del 15-20%.
        - Si es un Bajo, aplica un coeficiente de reducción del 5-10% (salvo que tenga jardín privado).
        - Los estudios (0 dormitorios) tienen un precio por m² superior a la media de la zona.
        - Valora positivamente la presencia de aseos adicionales además de los baños completos.
        - La antigüedad (año de construcción) vs reformas es crítica: una casa antigua sin reformas pierde un 1-2% anual de valor de edificación.
        
        TAREA:
        1. Utiliza la herramienta de búsqueda para encontrar precios reales de mercado actuales en Idealista, Fotocasa o portales similares para propiedades similares en la zona específica de ${formData.address}, ${formData.city}.
        2. Aplica coeficientes de antigüedad y estado basados en los años de construcción y reforma.
        3. Considera la accesibilidad y la planta/altura.
        4. Calcula el valor final integrando el valor del suelo en la zona.
        
        Genera una respuesta en formato JSON con dos campos:
        - "summary": Un resumen ejecutivo profesional (2 párrafos) con el rango de precio final.
        - "breakdown": Un desglose técnico detallado que explique los coeficientes aplicados (Antigüedad, Planta, Accesibilidad, Valor Suelo, etc.).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { 
          responseMimeType: "application/json",
          tools: [{ googleSearch: {} }]
        }
      });

      const valuationData = JSON.parse(response.text || "{}");
      setResult({
        summary: valuationData.summary || "Error al generar resumen.",
        breakdown: valuationData.breakdown || "Error al generar desglose."
      });

      // Save lead to database
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          estimatedValue: valuationData.summary
        })
      });

      setStep(6); // Updated step count
    } catch (error) {
      console.error("Valuation error:", error);
      alert("Hubo un error al calcular la valoración técnica. Por favor, inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (showAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-blue-900" />
              Panel de Leads
            </h1>
            <button 
              onClick={() => setShowAdmin(false)}
              className="p-2 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <tr>
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Cliente</th>
                  <th className="px-6 py-4">Propiedad</th>
                  <th className="px-6 py-4">Valoración</th>
                  <th className="px-6 py-4">Contacto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      {new Date(lead.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 font-medium">{lead.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="font-bold">{lead.property_type} - {lead.size}m²</span>
                        <span className="text-slate-400">{lead.address}, {lead.city}</span>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                          {lead.floor !== null && lead.floor !== undefined && <span className="text-slate-500">Planta: {lead.floor}</span>}
                          {lead.house_floors !== null && lead.house_floors !== undefined && <span className="text-slate-500">Plantas: {lead.house_floors}</span>}
                          <span className="text-slate-500">Dorm: {lead.rooms} | Baños: {lead.bathrooms} | Aseos: {lead.half_baths}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] font-bold uppercase">
                          {lead.construction_year && <span className="text-amber-600">Const: {lead.construction_year}</span>}
                          {lead.last_full_renovation_year && <span className="text-blue-900">Integral: {lead.last_full_renovation_year}</span>}
                          {lead.last_partial_renovation_year && <span className="text-blue-700">Parcial: {lead.last_partial_renovation_year}</span>}
                          {lead.accessibility !== 'Ninguna' && <span className="text-emerald-600">Accesible: {lead.accessibility}</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate text-xs text-slate-500">
                        {lead.estimated_value}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <a href={`mailto:${lead.email}`} className="text-blue-900 hover:underline">{lead.email}</a>
                        <span className="text-slate-400">{lead.phone}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-blue-900 p-2 rounded-xl shadow-lg shadow-blue-100">
              <Home className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight">ValoraCasa <span className="text-blue-900">Pro</span></span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Seguro</span>
              <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Actualizado</span>
            </div>
            <button 
              onClick={() => setShowAdmin(true)}
              className="text-slate-300 hover:text-slate-500 transition-colors"
              title="Admin Panel"
            >
              <LayoutDashboard className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-12 px-6">
        <div className="mb-12 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight text-slate-900">
            Valoración Inmobiliaria <span className="text-blue-900 italic">Inteligente</span>
          </h1>
          <p className="text-slate-500 text-lg leading-relaxed">
            Utilizamos algoritmos avanzados y datos reales de la Costa del Sol para darte el precio más preciso de mercado en menos de 2 minutos.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-16 max-w-2xl mx-auto">
          <div className="flex justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -translate-y-1/2 z-0"></div>
            <motion.div 
              className="absolute top-1/2 left-0 h-0.5 bg-blue-900 -translate-y-1/2 z-0"
              initial={{ width: '0%' }}
              animate={{ width: `${((step - 1) / 5) * 100}%` }}
            />
            {[1, 2, 3, 4, 5, 6].map((s) => (
              <div 
                key={s}
                className={`w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 transition-all duration-500 ${
                  step >= s 
                    ? 'bg-blue-900 border-blue-100 text-white shadow-lg shadow-blue-100' 
                    : 'bg-white border-slate-100 text-slate-300'
                }`}
              >
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : <span className="text-sm font-bold">{s}</span>}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span>Zona</span>
            <span>Vivienda</span>
            <span>Estado</span>
            <span>Extras</span>
            <span>Contacto</span>
            <span>Precio</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Wizard Card */}
          <div className="lg:col-span-8 bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-10 min-h-[500px] flex flex-col relative overflow-hidden">
            {/* Background Accent */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
            
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8 flex-1 relative z-10"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Ubicación de la propiedad</h2>
                    <p className="text-slate-400 text-sm">Empecemos por situar tu vivienda en el mapa.</p>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="group">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Dirección o Zona</label>
                      <div className="relative">
                        <input 
                          type="text"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50 group-hover:bg-white"
                          placeholder="Ej: Puerto Banús, Marbella"
                          value={formData.address}
                          onChange={e => setFormData({...formData, address: e.target.value})}
                        />
                        <MapPin className="absolute right-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Municipio</label>
                      <select 
                        className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                        value={formData.city}
                        onChange={e => setFormData({...formData, city: e.target.value})}
                      >
                        <option>Málaga</option>
                        <option>Marbella</option>
                        <option>Estepona</option>
                        <option>Fuengirola</option>
                        <option>Benalmádena</option>
                        <option>Mijas</option>
                        <option>Torremolinos</option>
                        <option>Alhaurín de la Torre</option>
                        <option>Alhaurín el Grande</option>
                        <option>Coín</option>
                        <option>Cártama</option>
                        <option>Pizarra</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8 flex-1 relative z-10"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Características principales</h2>
                    <p className="text-slate-400 text-sm">Define los aspectos básicos de tu hogar.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Tipo de Propiedad</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PROPERTY_TYPES.map(t => (
                          <button
                            key={t}
                            onClick={() => {
                              const rooms = t === 'Estudio' ? 0 : formData.rooms;
                              setFormData({...formData, propertyType: t, rooms});
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                              formData.propertyType === t 
                                ? 'bg-blue-900 text-white border-blue-900' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {['Piso', 'Ático', 'Dúplex', 'Estudio'].includes(formData.propertyType) && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Planta</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          placeholder="Ej: 3"
                          value={formData.floor || ''}
                          onChange={e => setFormData({...formData, floor: e.target.value ? parseInt(e.target.value) : undefined})}
                        />
                      </div>
                    )}

                    {['Casa', 'Chalet', 'Villa', 'Adosado', 'Pareado'].includes(formData.propertyType) && (
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nº de Plantas</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          placeholder="Ej: 2"
                          value={formData.houseFloors || ''}
                          onChange={e => setFormData({...formData, houseFloors: e.target.value ? parseInt(e.target.value) : undefined})}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Superficie (m²)</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          value={formData.size}
                          onChange={e => setFormData({...formData, size: parseInt(e.target.value)})}
                        />
                        <Maximize className="absolute right-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Dormitorios</label>
                      <div className="relative">
                        <input 
                          type="number"
                          disabled={formData.propertyType === 'Estudio'}
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50 disabled:opacity-50"
                          value={formData.rooms}
                          onChange={e => setFormData({...formData, rooms: parseInt(e.target.value)})}
                        />
                        <Bed className="absolute right-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Baños Completos</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          value={formData.bathrooms}
                          onChange={e => setFormData({...formData, bathrooms: parseInt(e.target.value)})}
                        />
                        <Bath className="absolute right-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Aseos</label>
                      <div className="relative">
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          value={formData.halfBaths}
                          onChange={e => setFormData({...formData, halfBaths: parseInt(e.target.value)})}
                        />
                        <Sparkles className="absolute right-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8 flex-1 relative z-10"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Estado y Antigüedad</h2>
                    <p className="text-slate-400 text-sm">¿Cuándo fue la última vez que se renovó?</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Estado de conservación</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {CONDITIONS.map(c => (
                          <button
                            key={c}
                            onClick={() => setFormData({...formData, condition: c})}
                            className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                              formData.condition === c 
                                ? 'bg-blue-900 text-white border-blue-900 shadow-lg shadow-blue-100' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Año Construcción</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          placeholder="Ej: 1990"
                          value={formData.constructionYear || ''}
                          onChange={e => setFormData({...formData, constructionYear: e.target.value ? parseInt(e.target.value) : undefined})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Año Reforma Integral</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          placeholder="Ej: 2020"
                          value={formData.lastFullRenovationYear || ''}
                          onChange={e => setFormData({...formData, lastFullRenovationYear: e.target.value ? parseInt(e.target.value) : undefined})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Año Reforma Parcial</label>
                        <input 
                          type="number"
                          className="w-full px-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50"
                          placeholder="Ej: 2023"
                          value={formData.lastPartialRenovationYear || ''}
                          onChange={e => setFormData({...formData, lastPartialRenovationYear: e.target.value ? parseInt(e.target.value) : undefined})}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div 
                  key="step4"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8 flex-1 relative z-10"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Extras y Accesibilidad</h2>
                    <p className="text-slate-400 text-sm">Detalles que marcan la diferencia.</p>
                  </div>

                  <div className="space-y-8">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Características Extra</label>
                      <div className="flex flex-wrap gap-3">
                        {FEATURES.map(f => (
                          <button
                            key={f}
                            onClick={() => toggleFeature(f)}
                            className={`px-5 py-3 rounded-full text-xs font-bold border transition-all flex items-center gap-2 ${
                              formData.features.includes(f)
                                ? 'bg-blue-50 text-blue-900 border-blue-200 shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                              formData.features.includes(f) ? 'bg-blue-900 border-blue-900' : 'border-slate-200'
                            }`}>
                              {formData.features.includes(f) && <CheckCircle2 className="w-3 h-3 text-white" />}
                            </div>
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">Adaptada a minusválidos</label>
                      <div className="grid grid-cols-3 gap-3">
                        {["Ninguna", "Parcial", "Total"].map(a => (
                          <button
                            key={a}
                            onClick={() => setFormData({...formData, accessibility: a as any})}
                            className={`px-4 py-3 rounded-2xl text-sm font-bold border transition-all ${
                              formData.accessibility === a 
                                ? 'bg-blue-900 text-white border-blue-900 shadow-lg shadow-blue-100' 
                                : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'
                            }`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 5 && (
                <motion.div 
                  key="step5"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="space-y-8 flex-1 relative z-10"
                >
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Recibe tu valoración</h2>
                    <p className="text-slate-400 text-sm">¿A quién debemos enviar el informe detallado?</p>
                  </div>

                  <div className="space-y-5">
                    <div className="group">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Nombre completo</label>
                      <div className="relative">
                        <input 
                          type="text"
                          className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50 group-hover:bg-white"
                          placeholder="Juan Pérez"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                        <User className="absolute left-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Email Profesional</label>
                      <div className="relative">
                        <input 
                          type="email"
                          className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50 group-hover:bg-white"
                          placeholder="juan@ejemplo.com"
                          value={formData.email}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                        />
                        <Mail className="absolute left-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                    <div className="group">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Teléfono de contacto</label>
                      <div className="relative">
                        <input 
                          type="tel"
                          className="w-full pl-14 pr-6 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-900 outline-none transition-all bg-slate-50/50 group-hover:bg-white"
                          placeholder="+34 600 000 000"
                          value={formData.phone}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                        />
                        <Phone className="absolute left-6 top-4.5 text-slate-300 w-5 h-5" />
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] text-slate-400 leading-relaxed text-center">
                      Al solicitar la valoración, aceptas que Alberto Barollo trate tus datos para enviarte el informe y contactarte. Cumplimos estrictamente con el RGPD.
                    </p>
                  </div>
                </motion.div>
              )}

              {step === 6 && (
                <motion.div 
                  key="step6"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-8 flex-1 text-center relative z-10"
                >
                  <div className="inline-flex bg-blue-900 p-5 rounded-3xl shadow-xl shadow-blue-200 mb-2">
                    <Calculator className="text-white w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-extrabold text-slate-900">Informe de Valoración</h2>
                    <p className="text-slate-400 text-sm">Basado en el Método Técnico de Comparación.</p>
                  </div>
                  
                  <div className="space-y-4 text-left">
                    <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4">
                        <Sparkles className="text-blue-200 w-12 h-12 rotate-12" />
                      </div>
                      <h3 className="text-blue-900 font-bold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" /> Resumen Ejecutivo
                      </h3>
                      <div className="prose prose-slate prose-sm max-w-none relative z-10 text-blue-900">
                        {String(result?.summary || "").split('\n').map((line, i) => (
                          <p key={i} className="mb-3 last:mb-0 leading-relaxed font-medium">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-8">
                      <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2">
                        <LayoutDashboard className="w-5 h-5 text-slate-400" /> Desglose Técnico Profesional
                      </h3>
                      <div className="prose prose-slate prose-sm max-w-none text-slate-600">
                        {String(result?.breakdown || "").split('\n').map((line, i) => (
                          <p key={i} className="mb-2 last:mb-0 text-xs font-mono">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-6">
                    <p className="text-sm text-slate-500 max-w-md">
                      Este informe ha sido generado aplicando los coeficientes técnicos de tasación profesional para la zona de {formData.city}.
                    </p>
                    <a 
                      href="https://albertobarollo.com/contacta-conmigo/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold hover:bg-blue-900 transition-all shadow-2xl shadow-slate-200 hover:shadow-blue-200"
                    >
                      Validar con Alberto Barollo <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation Buttons */}
            {step < 6 && (
              <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center relative z-10">
                {step > 1 ? (
                  <button 
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-400 font-bold text-sm hover:text-slate-900 transition-colors px-4 py-2"
                  >
                    <ChevronLeft className="w-4 h-4" /> Anterior
                  </button>
                ) : <div />}

                {step < 5 ? (
                  <button 
                    onClick={handleNext}
                    disabled={step === 1 && !formData.address}
                    className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-900 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
                  >
                    Siguiente <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button 
                    onClick={calculateValuation}
                    disabled={loading || !formData.name || !formData.email}
                    className="bg-blue-900 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-blue-800 transition-all disabled:opacity-50 shadow-xl shadow-blue-200"
                  >
                    {loading ? (
                      <>Procesando... <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /></>
                    ) : (
                      <>Generar Informe Técnico <Calculator className="w-4 h-4" /></>
                    )}
                  </button>
                )}
              </div>
            )}
            {step === 6 && (
              <div className="mt-12 pt-8 border-t border-slate-100 flex justify-center items-center relative z-10">
                <button 
                  onClick={() => {
                    setStep(1);
                    setResult(null);
                  }}
                  className="text-blue-900 font-bold hover:text-blue-800 transition-colors flex items-center gap-2"
                >
                  <Calculator className="w-4 h-4" /> Realizar otra valoración
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Trust Section */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
              <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                <ShieldCheck className="text-blue-900 w-5 h-5" />
                ¿Por qué confiar?
              </h3>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="bg-blue-50 p-3 rounded-2xl h-fit">
                    <TrendingUp className="text-blue-900 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Precisión Local</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Datos actualizados de transacciones reales en la Costa del Sol.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-blue-50 p-3 rounded-2xl h-fit">
                    <Clock className="text-blue-900 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Venta en 30 días</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Nuestro método de valoración está diseñado para vender rápido.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="bg-blue-50 p-3 rounded-2xl h-fit">
                    <Sparkles className="text-blue-900 w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">IA de Vanguardia</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">Analizamos miles de variables para darte un precio justo.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 text-white relative overflow-hidden">
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-2xl"></div>
              <h3 className="font-bold mb-4 relative z-10">Alberto Barollo</h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6 relative z-10">
                "Mi objetivo es que no pierdas ni un euro en la venta de tu casa. Una valoración profesional es el primer paso al éxito."
              </p>
              <div className="flex items-center gap-3 relative z-10">
                <div className="w-10 h-10 rounded-full bg-blue-900 flex items-center justify-center font-bold">AB</div>
                <div>
                  <div className="text-xs font-bold">Experto Inmobiliario</div>
                  <div className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Costa del Sol</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-12 px-6 border-t border-slate-200 bg-white mt-20">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 grayscale opacity-50">
            <Home className="w-5 h-5" />
            <span className="font-bold text-lg">ValoraCasa Pro</span>
          </div>
          <div className="text-slate-400 text-xs font-medium text-center sm:text-left">
            © 2024 Alberto Barollo Real Estate. Servicio de valoración gratuita para propietarios en la Costa del Sol.
          </div>
          <div className="flex gap-8 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <a href="https://albertobarollo.com/politica-privacidad/" className="hover:text-blue-900 transition-colors">Privacidad</a>
            <a href="https://albertobarollo.com/contacta-conmigo/" className="hover:text-blue-900 transition-colors">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
