
export async function transactionCommit(transaction){
    try{
        await transaction.commit();
    }
    catch(err){
        throw new Error(err.message);
    }
}

export async function transactionRollback(transaction){
    try{
        await transaction.rollback();
    }
    catch{}
}