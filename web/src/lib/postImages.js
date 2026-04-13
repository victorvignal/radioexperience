import { supabase } from './supabase'

export const POST_IMAGE_BUCKET = 'post-images'
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export function getPostImageUrl(post) {
  return post?.image_url || post?.metadata?.image_url || null
}

export function buildPostMetadata(existingMetadata = {}, imageUrl = null) {
  const next = { ...(existingMetadata || {}) }
  if (imageUrl) next.image_url = imageUrl
  else delete next.image_url
  return next
}

export function validateImageFile(file) {
  if (!file) return null
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('Use JPG, PNG, WEBP ou GIF.')
  }
  return file
}

export async function uploadPostImage(file, userId) {
  validateImageFile(file)
  const ext = file.name?.split('.').pop()?.toLowerCase() || 'jpg'
  const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg'
  const filePath = `${userId || 'anonymous'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(POST_IMAGE_BUCKET)
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (uploadError) {
    if (String(uploadError.message || '').toLowerCase().includes('bucket')) {
      throw new Error('Bucket do Supabase Storage não encontrado. Crie o bucket público "post-images".')
    }
    throw uploadError
  }

  const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(filePath)
  return data?.publicUrl || null
}

export function readImagePreview(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve('')
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'))
    reader.readAsDataURL(file)
  })
}
