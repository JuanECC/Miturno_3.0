import { forwardRef } from 'react';

const DocumentoImprimible = forwardRef(({ tipo = 'atencion', datos }, ref) => {
  if (!datos) return null;

  const {
    paciente = {},
    medico = '',
    fecha = '',
    destino = '',
    diagnostico = '',
    diagnosticoDesc = '',
    motivo = '',
    nota = '',
    indicaciones = [],
    estudios = [],
  } = datos;

  const esExpediente = tipo === 'expediente';

  return (
    <div ref={ref} style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#000' }}>
      {/* Encabezado institucional */}
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '15px' }}>
        <h2 style={{ margin: 0, fontSize: '16px' }}>INSTITUTO MEXICANO DEL SEGURO SOCIAL</h2>
        <h3 style={{ margin: 0, fontSize: '13px' }}>HOSPITAL GENERAL DE ZONA - URGENCIAS</h3>
        <h3 style={{ margin: 0, fontSize: '13px' }}>
          {esExpediente ? 'EXPEDIENTE CLÍNICO ELECTRÓNICO' : 'NOTA DE ATENCIÓN MÉDICA'}
        </h3>
      </div>

      {/* Datos del paciente */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', width: '20%' }}>Paciente</td>
            <td style={{ border: '1px solid #000', padding: '6px' }}>{paciente.nombre}</td>
            <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', width: '15%' }}>Edad</td>
            <td style={{ border: '1px solid #000', padding: '6px' }}>{paciente.edad} años</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Especialidad</td>
            <td style={{ border: '1px solid #000', padding: '6px' }}>{paciente.especialidad || 'General'}</td>
            <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Fecha</td>
            <td style={{ border: '1px solid #000', padding: '6px' }}>{fecha}</td>
          </tr>
          {!esExpediente && (
            <>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Destino</td>
                <td style={{ border: '1px solid #000', padding: '6px' }}>{destino || '—'}</td>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Médico</td>
                <td style={{ border: '1px solid #000', padding: '6px' }}>{medico}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>Motivo</td>
                <td style={{ border: '1px solid #000', padding: '6px' }} colSpan="3">{motivo}</td>
              </tr>
            </>
          )}
        </tbody>
      </table>

      {/* Diagnóstico */}
      {diagnostico && (
        <div style={{ marginBottom: '10px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '5px' }}>DIAGNÓSTICO</h4>
          <p>{diagnostico}{diagnosticoDesc ? ` - ${diagnosticoDesc}` : ''}</p>
        </div>
      )}

      {/* Nota médica */}
      {nota && (
        <div style={{ marginBottom: '10px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '5px' }}>NOTA MÉDICA</h4>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{nota}</pre>
        </div>
      )}

      {/* Indicaciones */}
      {indicaciones.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '5px' }}>INDICACIONES</h4>
          {indicaciones.map((ind, i) => (
            <p key={i} style={{ margin: '2px 0' }}>- {ind.medicamento} {ind.dosis} {ind.via} {ind.frecuencia}</p>
          ))}
        </div>
      )}

      {/* Estudios */}
      {estudios.length > 0 && (
        <div style={{ marginBottom: '10px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 'bold', borderBottom: '1px solid #000', marginBottom: '5px' }}>ESTUDIOS SOLICITADOS</h4>
          {estudios.map((est, i) => (
            <p key={i} style={{ margin: '2px 0' }}>- {est.descripcion} ({est.tipo})</p>
          ))}
        </div>
      )}

      {/* Firmas */}
      <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', marginBottom: '5px' }}></div>
          <p style={{ margin: 0 }}>FIRMA DEL MÉDICO</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', marginBottom: '5px' }}></div>
          <p style={{ margin: 0 }}>FIRMA DEL PACIENTE</p>
        </div>
      </div>
    </div>
  );
});

DocumentoImprimible.displayName = 'DocumentoImprimible';

export default DocumentoImprimible;