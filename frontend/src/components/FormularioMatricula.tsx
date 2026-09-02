import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  User, Heart, FileText, CheckCircle, AlertCircle, X,
  ChevronDown, ChevronUp, Save, Phone
} from 'lucide-react';
import api from '../services/api';
import ContactosEmergencia from './ContactosEmergencia';
import ProgresoMatricula from './ProgresoMatricula';

const soloNumerosKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)) return;
  if (!/^\d$/.test(e.key)) e.preventDefault();
};
const soloLetrasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (['Backspace','Delete','Tab','ArrowLeft','ArrowRight',' ','-',"'"].includes(e.key)) return;
  if (/^\d$/.test(e.key)) e.preventDefault();
};

const GRUPOS_SANGUINEOS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];
const EPS_COLOMBIA = ['Sanitas','Sura','Nueva EPS','Compensar','Coomeva','Famisanar','Salud Total','Coosalud','Mutual Ser','Aliansalud','Otra'];

function Toast({ mensaje, tipo, onClose }: { mensaje: string; tipo: 'ok' | 'error'; onClose: () => void }) {
  return (
    <div className={`fixed bottom-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {tipo === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
      {mensaje}
      <button onClick={onClose}><X className="w-4 h-4" /></button>
    </div>
  );
}

const inputCls = (err?: string) =>
  `w-full px-3 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white ${err ? 'border-red-400' : 'border-slate-200'}`;

function Seccion({ titulo, icono, children, defaultAbierta = true }: { titulo: string; icono: React.ReactNode; children: React.ReactNode; defaultAbierta?: boolean }) {
  const [abierta, setAbierta] = useState(defaultAbierta);
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <button type="button" onClick={() => setAbierta(!abierta)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          {icono}
          <h3 className="font-semibold text-slate-700">{titulo}</h3>
        </div>
        {abierta ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {abierta && <div className="px-5 py-4">{children}</div>}
    </div>
  );
}

type DatosPadreForm = { telefono: string; telefonoAlt?: string; direccion?: string; ocupacion?: string; emailContacto?: string };
type DatosAdicionalesForm = { eps?: string; grupoSanguineo?: string; alergias?: string; condicionesMedicas?: string; medicamentos?: string; contactoMedico?: string; telefonoMedico?: string };

export default function FormularioMatricula({ estudianteId, hijoNombre }: { estudianteId: string; hijoNombre: string }) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  // Datos del padre
  const { data: datosPadre } = useQuery({
    queryKey: ['mis-hijos-perfil'],
    queryFn: async () => (await api.get('/estudiantes/mis-hijos')).data.datos?.[0],
  });

  // Datos adicionales del estudiante
  const { data: datosAdicionales } = useQuery({
    queryKey: ['datos-adicionales', estudianteId],
    queryFn: async () => (await api.get(`/estudiantes/${estudianteId}/datos-adicionales`)).data.datos,
    enabled: !!estudianteId,
    staleTime: 0,
  });

  const { register: regP, handleSubmit: hP, formState: { errors: eP } } = useForm<DatosPadreForm>();
  const { register: regA, handleSubmit: hA, watch: wA, formState: { errors: eA } } = useForm<DatosAdicionalesForm>();

  const watchAlergias = wA('alergias');
  const watchCondiciones = wA('condicionesMedicas');
  const watchMedicamentos = wA('medicamentos');

  const padresMutation = useMutation({
    mutationFn: (d: DatosPadreForm) => api.put('/padre/mis-datos', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['mis-hijos-perfil'] }); setToast({ msg: 'Datos del acudiente guardados', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  const adicMutation = useMutation({
    mutationFn: (d: DatosAdicionalesForm) => api.put(`/estudiantes/${estudianteId}/datos-adicionales`, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['datos-adicionales', estudianteId] }); setToast({ msg: 'Datos de salud guardados', tipo: 'ok' }); },
    onError: (e: unknown) => { const d = (e as { response?: { data?: { mensaje?: string } } })?.response?.data; setToast({ msg: d?.mensaje ?? 'Error', tipo: 'error' }); },
  });

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}

      <ProgresoMatricula estudianteId={estudianteId} />

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-1">Formulario de matrícula — {hijoNombre}</p>
        <p className="text-xs text-blue-600">Complete todos los datos y suba los documentos requeridos. La secretaría los verificará para activar la matrícula.</p>
      </div>

      {/* Datos del acudiente */}
      <Seccion titulo="Datos del acudiente/padre" icono={<User className="w-5 h-5 text-blue-600" />}>
        <form onSubmit={hP(d => padresMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono principal * <span className="text-slate-300">(7-10 dígitos)</span></label>
              <input className={inputCls(eP.telefono?.message)} placeholder="Ej: 3001234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                defaultValue={datosPadre?.telefono ?? ''}
                {...regP('telefono', { required: 'Requerido', pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {eP.telefono && <p className="mt-1 text-xs text-red-500">{eP.telefono.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono alternativo <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls(eP.telefonoAlt?.message)} placeholder="Ej: 6011234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                defaultValue={datosPadre?.telefonoAlt ?? ''}
                {...regP('telefonoAlt', { pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {eP.telefonoAlt && <p className="mt-1 text-xs text-red-500">{eP.telefonoAlt.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Dirección de residencia <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls(eP.direccion?.message)} placeholder="Ej: Calle 45 # 23-10, Bogotá" maxLength={150}
                defaultValue={datosPadre?.direccion ?? ''}
                {...regP('direccion', { minLength: { value: 5, message: 'Mínimo 5 caracteres' }, maxLength: { value: 150, message: 'Máximo 150' } })} />
              {eP.direccion && <p className="mt-1 text-xs text-red-500">{eP.direccion.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Ocupación <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls(eP.ocupacion?.message)} placeholder="Ej: Contador, Docente" maxLength={80} onKeyDown={soloLetrasKeyDown}
                defaultValue={datosPadre?.ocupacion ?? ''}
                {...regP('ocupacion', { maxLength: { value: 80, message: 'Máximo 80 caracteres' } })} />
              {eP.ocupacion && <p className="mt-1 text-xs text-red-500">{eP.ocupacion.message}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Correo personal <span className="text-slate-300">(opcional)</span></label>
              <input type="email" className={inputCls(eP.emailContacto?.message)} placeholder="correo@personal.com" maxLength={100}
                defaultValue={datosPadre?.emailContacto ?? ''}
                {...regP('emailContacto', { pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
              {eP.emailContacto && <p className="mt-1 text-xs text-red-500">{eP.emailContacto.message}</p>}
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" disabled={padresMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              <Save className="w-4 h-4" /> {padresMutation.isPending ? 'Guardando...' : 'Guardar datos'}
            </button>
          </div>
        </form>
      </Seccion>

      {/* Contactos de emergencia */}
      <Seccion titulo="Contactos de emergencia" icono={<Phone className="w-5 h-5 text-violet-600" />}>
        <ContactosEmergencia estudianteId={estudianteId} />
      </Seccion>

      {/* Datos de salud del estudiante */}
      <Seccion titulo={`Datos de salud — ${hijoNombre}`} icono={<Heart className="w-5 h-5 text-red-500" />}>
        <form onSubmit={hA(d => adicMutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">EPS <span className="text-slate-300">(opcional)</span></label>
              <select className={inputCls(eA.eps?.message)} defaultValue={datosAdicionales?.eps ?? ''} {...regA('eps')}>
                <option value="">Seleccionar EPS</option>
                {EPS_COLOMBIA.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Grupo sanguíneo <span className="text-slate-300">(opcional)</span></label>
              <select className={inputCls(eA.grupoSanguineo?.message)} defaultValue={datosAdicionales?.grupoSanguineo ?? ''} {...regA('grupoSanguineo')}>
                <option value="">Seleccionar</option>
                {GRUPOS_SANGUINEOS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Médico de cabecera <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls()} placeholder="Nombre del médico" maxLength={100} onKeyDown={soloLetrasKeyDown}
                defaultValue={datosAdicionales?.contactoMedico ?? ''}
                {...regA('contactoMedico', { maxLength: { value: 100, message: 'Máximo 100' } })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Teléfono médico <span className="text-slate-300">(opcional)</span></label>
              <input className={inputCls(eA.telefonoMedico?.message)} placeholder="Ej: 3001234567" maxLength={10} onKeyDown={soloNumerosKeyDown}
                defaultValue={datosAdicionales?.telefonoMedico ?? ''}
                {...regA('telefonoMedico', { pattern: { value: /^[0-9]{7,10}$/, message: '7 a 10 dígitos' } })} />
              {eA.telefonoMedico && <p className="mt-1 text-xs text-red-500">{eA.telefonoMedico.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Alergias <span className="text-slate-300">(opcional · máx. 500 caracteres)</span>
            </label>
            <textarea rows={3} maxLength={500} className={`${inputCls(eA.alergias?.message)} resize-none`}
              placeholder="Describe las alergias conocidas del estudiante..."
              defaultValue={datosAdicionales?.alergias ?? ''}
              {...regA('alergias', { maxLength: { value: 500, message: 'Máximo 500 caracteres' } })} />
            <p className="text-xs text-right text-slate-400 mt-0.5">{watchAlergias?.length ?? 0}/500</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Condiciones médicas <span className="text-slate-300">(opcional · máx. 500 caracteres)</span>
            </label>
            <textarea rows={3} maxLength={500} className={`${inputCls(eA.condicionesMedicas?.message)} resize-none`}
              placeholder="Ej: Asma, diabetes, epilepsia..."
              defaultValue={datosAdicionales?.condicionesMedicas ?? ''}
              {...regA('condicionesMedicas', { maxLength: { value: 500, message: 'Máximo 500 caracteres' } })} />
            <p className="text-xs text-right text-slate-400 mt-0.5">{watchCondiciones?.length ?? 0}/500</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Medicamentos <span className="text-slate-300">(opcional · máx. 500 caracteres)</span>
            </label>
            <textarea rows={3} maxLength={500} className={`${inputCls(eA.medicamentos?.message)} resize-none`}
              placeholder="Medicamentos que toma regularmente..."
              defaultValue={datosAdicionales?.medicamentos ?? ''}
              {...regA('medicamentos', { maxLength: { value: 500, message: 'Máximo 500 caracteres' } })} />
            <p className="text-xs text-right text-slate-400 mt-0.5">{watchMedicamentos?.length ?? 0}/500</p>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button type="submit" disabled={adicMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50">
              <Save className="w-4 h-4" /> {adicMutation.isPending ? 'Guardando...' : 'Guardar datos de salud'}
            </button>
          </div>
        </form>
      </Seccion>

      {/* Documentos requeridos */}
      <Seccion titulo="Documentos requeridos" icono={<FileText className="w-5 h-5 text-emerald-600" />}>
        <DocumentosMatricula estudianteId={estudianteId} />
      </Seccion>

      {/* Firma digital */}
      <Seccion titulo="Firma y envío" icono={<Save className="w-5 h-5 text-violet-600" />}>
        <FirmaDigital estudianteId={estudianteId} hijoNombre={hijoNombre} />
      </Seccion>
    </div>
  );
}

// ─── FIRMA DIGITAL ────────────────────────────────────────────────────────────
type FirmaForm = { nombreCompleto: string };

function FirmaDigital({ estudianteId, hijoNombre }: { estudianteId: string; hijoNombre: string }) {
  const qc = useQueryClient();
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<FirmaForm>();

  const { data: progreso } = useQuery<{ firmaDigitalNombre: string | null; firmaDigitalFecha: string | null }>({
    queryKey: ['mi-matricula', estudianteId],
    queryFn: async () => (await api.get(`/matriculas/estudiante/${estudianteId}`)).data.datos,
    enabled: !!estudianteId,
  });

  const firmarMutation = useMutation({
    mutationFn: (d: FirmaForm) => api.patch(`/matriculas/estudiante/${estudianteId}/firmar`, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mi-matricula', estudianteId] });
      setToast({ msg: 'Formulario firmado correctamente', tipo: 'ok' });
    },
    onError: (e: unknown) => {
      const d = (e as { response?: { data?: { mensaje?: string; errores?: string[] } } })?.response?.data;
      setToast({ msg: d?.errores?.[0] ?? d?.mensaje ?? 'Error al firmar', tipo: 'error' });
    },
  });

  if (progreso?.firmaDigitalNombre) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-emerald-800">Formulario firmado por {progreso.firmaDigitalNombre}</p>
          {progreso.firmaDigitalFecha && (
            <p className="text-xs text-emerald-600">{new Date(progreso.firmaDigitalFecha).toLocaleString('es-CO')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <div className="bg-slate-50 rounded-xl p-4 max-h-40 overflow-y-auto text-xs text-slate-500 leading-relaxed">
        Al firmar declaro que la información y los documentos suministrados en este formulario de matrícula
        de {hijoNombre} son veraces y completos. Autorizo al colegio a verificarlos y entiendo que cualquier
        inconsistencia puede retrasar o afectar el proceso de matrícula. Esta firma electrónica tiene la misma
        validez que una firma manuscrita para efectos del proceso de matrícula.
      </div>
      <form onSubmit={handleSubmit(d => firmarMutation.mutate(d))} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Escribe tu nombre completo como firma *</label>
          <input className={inputCls(errors.nombreCompleto?.message)} placeholder="Nombre y apellidos completos"
            {...register('nombreCompleto', { required: 'Requerido', minLength: { value: 5, message: 'Mínimo 5 caracteres' }, maxLength: { value: 100, message: 'Máximo 100 caracteres' } })} />
          {errors.nombreCompleto && <p className="mt-1 text-xs text-red-500">{errors.nombreCompleto.message}</p>}
        </div>
        <div className="flex justify-end">
          <button type="submit" disabled={firmarMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-xl hover:bg-violet-700 transition disabled:opacity-50">
            <Save className="w-4 h-4" /> {firmarMutation.isPending ? 'Firmando...' : 'Firmar y completar formulario'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── DOCUMENTOS DE MATRÍCULA ──────────────────────────────────────────────────
function DocumentosMatricula({ estudianteId }: { estudianteId: string }) {
  const qc = useQueryClient();
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null);

  const { data: tiposDoc = [] } = useQuery({
    queryKey: ['tipos-documento'],
    queryFn: async () => (await api.get('/tipos-documento')).data.datos ?? [],
  });

  const { data: archivos = [], refetch } = useQuery({
    queryKey: ['archivos-matricula', estudianteId],
    queryFn: async () => (await api.get(`/archivos/estudiante/${estudianteId}`)).data.datos ?? [],
    enabled: !!estudianteId,
    staleTime: 0,
  });

  type TipoDoc = { id: string; nombre: string; descripcion?: string; obligatorio: boolean };
  type ArchivoRow = { id: string; nombreOriginal: string; tamanoBytes: number; tipoDocumentoId?: string; tipoDocumento?: { nombre: string } };

  const archivosPorTipo = (tipo: TipoDoc) =>
    (archivos as ArchivoRow[]).filter(a => a.tipoDocumentoId === tipo.id);

  const subirDocumento = async (e: React.ChangeEvent<HTMLInputElement>, tipoId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setToast({ msg: 'Solo se permiten archivos PDF', tipo: 'error' }); return; }
    if (file.size > 10 * 1024 * 1024) { setToast({ msg: 'El archivo no puede superar 10 MB', tipo: 'error' }); return; }

    setSubiendo(tipoId);
    try {
      const fd = new FormData();
      fd.append('archivo', file);
      fd.append('estudianteId', estudianteId);
      fd.append('tipo', 'AUTORIZACION');
      fd.append('descripcion', file.name);
      fd.append('visibleParaPadre', 'true');
      fd.append('tipoDocumentoId', tipoId);
      await api.post('/archivos', fd);
      await qc.invalidateQueries({ queryKey: ['archivos-matricula', estudianteId] });
      await refetch();
      setToast({ msg: 'Documento subido correctamente', tipo: 'ok' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { mensaje?: string } } })?.response?.data?.mensaje ?? 'Error al subir';
      setToast({ msg, tipo: 'error' });
    } finally {
      setSubiendo(null);
      e.target.value = '';
    }
  };

  const verArchivo = async (archivoId: string) => {
    try {
      const res = await api.get(`/archivos/${archivoId}/descargar`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch { setToast({ msg: 'Error al abrir el archivo', tipo: 'error' }); }
  };

  if ((tiposDoc as TipoDoc[]).length === 0) return (
    <p className="text-sm text-slate-400 italic text-center py-4">El colegio configurará los documentos requeridos próximamente.</p>
  );

  return (
    <div className="space-y-3">
      {toast && <Toast mensaje={toast.msg} tipo={toast.tipo} onClose={() => setToast(null)} />}
      <p className="text-xs text-slate-500">Los marcados con <span className="text-red-500 font-bold">*</span> son obligatorios. Solo archivos PDF · Máximo 10 MB.</p>

      {(tiposDoc as TipoDoc[]).map(tipo => {
        const docs = archivosPorTipo(tipo);
        const subido = docs.length > 0;
        return (
          <div key={tipo.id} className={`rounded-xl border p-4 ${subido ? 'border-emerald-200 bg-emerald-50' : tipo.obligatorio ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {subido
                    ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    : <AlertCircle className={`w-4 h-4 flex-shrink-0 ${tipo.obligatorio ? 'text-red-500' : 'text-slate-400'}`} />
                  }
                  <p className="text-sm font-medium text-slate-800">
                    {tipo.nombre} {tipo.obligatorio && <span className="text-red-500">*</span>}
                  </p>
                </div>
                {tipo.descripcion && <p className="text-xs text-slate-400 mt-0.5 ml-6">{tipo.descripcion}</p>}
                {subido && (
                  <div className="ml-6 mt-2 space-y-1">
                    {docs.map(doc => (
                      <div key={doc.id} className="flex items-center gap-2">
                        <span className="text-xs text-emerald-700 truncate">{doc.nombreOriginal}</span>
                        <span className="text-xs text-slate-400">({(doc.tamanoBytes / 1024).toFixed(0)} KB)</span>
                        <button onClick={() => verArchivo(doc.id)} className="text-xs text-blue-600 hover:underline flex-shrink-0">Ver</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl cursor-pointer transition-colors flex-shrink-0 ${subiendo === tipo.id ? 'opacity-50 cursor-wait' : subido ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                <FileText className="w-3.5 h-3.5" />
                {subiendo === tipo.id ? 'Subiendo...' : subido ? 'Reemplazar' : 'Subir PDF'}
                <input type="file" accept="application/pdf" className="hidden" disabled={subiendo !== null}
                  onChange={e => subirDocumento(e, tipo.id)} />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}