import { INoteRepository } from '../domain/Note';

export class DeleteNoteUseCase {
    constructor(private noteRepository: INoteRepository) { }

    async execute(id: string, userId: string): Promise<boolean> {
        const note = await this.noteRepository.findById(id, userId);
        if (!note) {
            return false;
        }

        // Soft delete - can be restored later
        await this.noteRepository.delete(id, userId);
        return true;
    }

    async executePermanent(id: string, userId: string): Promise<boolean> {
        // Note is in trash, so findById (which filters deletedAt IS NULL) won't find it.
        // Check deleted notes instead.
        const deletedNotes = await this.noteRepository.findDeleted(userId);
        const note = deletedNotes.find(n => n.id === id);
        if (!note) {
            return false;
        }

        // Hard delete - cannot be recovered
        await this.noteRepository.permanentDelete(id, userId);
        return true;
    }

    async executeRestore(id: string, userId: string): Promise<boolean> {
        const note = await this.noteRepository.findById(id, userId);
        if (!note) {
            // Note might be deleted, so also check deleted notes
            const deletedNotes = await this.noteRepository.findDeleted(userId);
            const deletedNote = deletedNotes.find(n => n.id === id);
            if (!deletedNote) {
                return false;
            }
        }

        await this.noteRepository.restore(id, userId);
        return true;
    }
}
